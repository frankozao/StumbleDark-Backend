const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const child_process = require("child_process");

const HEARTBEAT_INTERVAL = 30000;
const SNAPSHOT_LIMIT = 100;
const MAX_STRIKES = 10;
const ALLOWED_DLL_PREFIXES = ["StumbleDark"];
const BLACKLISTED_PROCESSES = [
    "ida", "ida64", "x64dbg", "x32dbg", "windbg", "ollydbg",
    "processhacker", "procmon", "procexp", "wireshark", "fiddler",
    "dnspy", "cheatengine", "radare2", "cutter", "ghidra", "immunitydebugger", "scylla", "scylla_x64", "scylla_x86",
    "de4dot", "dnlib", "ilspy", "dotpeek", "reflexil", "dnlib", "pe-bear", "x64dbg", "x32dbg", "ghidra", "visual studio",
    "vscode", "jetbrains", "pycharm", "eclipse", "netbeans", "intellij", "clion", "rider", "android studio", "visual studio code",
    "ida pro", "ida free", "ida demo", "ida hex-rays", "ida disassembler", "ida debugger", "ida plugin", "ida script",
    "cheat engine", "cheatengine", "cheat engine 7", "cheat engine 6", "cheat engine 5", "cheat engine 4", "cheat engine 3",
    "cheat engine 2", "cheat engine 1", "cheat engine 0", "cheat engine pro", "cheat engine lite", "cheat engine free",
    "cheat engine ultimate", "cheat engine deluxe", "cheat engine standard", "cheat engine basic", "cheat engine advanced",
    "cheat engine expert", "cheat engine master", "cheat engine guru", "cheat engine ninja", "cheat engine samurai",
    "cheat engine sensei", "cheat engine shogun", "cheat engine warlord",
    "cheat engine overlord", "cheat engine emperor", "cheat engine king", "cheat engine queen", "cheat engine prince",
    "cheat engine princess", "cheat engine duke", "cheat engine duchess", "cheat engine baron", "cheat engine baroness",
    "cheat engine count", "cheat engine countess", "cheat engine marquis", "cheat engine marchioness", "cheat engine viscount",
    "resource hacker"
];

const mongoUri = process.env.MONGO_URI;
const dbName = "StumbleDark";
const collectionName = "AntiCheat";

let client;
let db;
let collection;
let deviceCache = new Map();

async function connect() {
    if (collection) return;
    
    if (!mongoUri) {
        throw new Error("MONGO_URI environment variable is required");
    }
    
    client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    collection = db.collection(collectionName);
    
    await collection.createIndex({ deviceId: 1 }, { unique: true });
}

function checkUnauthorizedDlls() {
    const modsFolder = path.join(process.cwd(), "Mods");
    if (!fs.existsSync(modsFolder)) return [];
    
    try {
        const dlls = fs.readdirSync(modsFolder).filter(f => f.endsWith(".dll"));
        return dlls.filter(dll => !ALLOWED_DLL_PREFIXES.some(p => dll.startsWith(p)));
    } catch {
        return [];
    }
}

function checkBlacklistedProcesses() {
    return new Promise(resolve => {
        const running = [];
        let completed = 0;
        
        if (BLACKLISTED_PROCESSES.length === 0) {
            resolve(running);
            return;
        }
        
        BLACKLISTED_PROCESSES.forEach(procName => {
            child_process.exec(`tasklist`, (err, stdout) => {
                if (!err && stdout.toLowerCase().includes(procName.toLowerCase())) {
                    running.push(procName);
                }
                completed++;
                if (completed === BLACKLISTED_PROCESSES.length) {
                    resolve(running);
                }
            });
        });
    });
}

function createSnapshot() {
    const mem = process.memoryUsage();
    
    return {
        uptime_ms: process.uptime() * 1000,
        mem_rss_kb: Math.floor(mem.rss / 1024),
        mem_heap_kb: Math.floor(mem.heapUsed / 1024),
        thread_count: os.cpus().length,
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch,
        suspiciousDlls: checkUnauthorizedDlls(),
        timestamp: new Date()
    };
}

function getConfig() {
    return {
        heartbeatInterval: HEARTBEAT_INTERVAL,
        maxStrikes: MAX_STRIKES,
        snapshotLimit: SNAPSHOT_LIMIT,
        blacklistedProcesses: BLACKLISTED_PROCESSES,
        allowedDllPrefixes: ALLOWED_DLL_PREFIXES,
        serverTime: new Date().toISOString()
    };
}

async function processHeartbeat(deviceId, data) {
    await connect();
    
    const snapshot = createSnapshot();
    const blacklistedProcesses = await checkBlacklistedProcesses();
    
    if (blacklistedProcesses.length > 0) {
        await collection.updateOne(
            { deviceId },
            { 
                $set: { 
                    lastHeartbeat: new Date(),
                    snapshot: { ...snapshot, blacklistedProcesses },
                    violationDetected: true,
                    violationType: "blacklisted_process",
                    violationDetails: blacklistedProcesses.join(", ")
                }
            },
            { upsert: true }
        );
        
        deviceCache.delete(deviceId);
        return { warning: "Blacklisted processes detected", blacklistedProcesses };
    }
    
    await collection.updateOne(
        { deviceId },
        { 
            $set: { 
                lastHeartbeat: new Date(),
                snapshot: { ...snapshot, blacklistedProcesses: [] },
                violationDetected: false
            }
        },
        { upsert: true }
    );
    
    deviceCache.delete(deviceId);
    return { success: true };
}

async function registerViolation(deviceId, violationData) {
    await connect();
    
    const existing = await collection.findOne({ deviceId });
    let strikes = existing ? existing.strikes || 0 : 0;
    strikes++;
    
    const banned = strikes >= MAX_STRIKES;
    
    await collection.updateOne(
        { deviceId },
        {
            $set: {
                lastReport: new Date(),
                lastViolationType: violationData.type,
                lastViolationDetails: violationData.details,
                gameVersion: violationData.gameVersion || "unknown",
                platform: violationData.platform || "unknown",
                strikes,
                banned,
                bannedAt: banned ? new Date() : null
            },
            $push: {
                violationHistory: {
                    type: violationData.type,
                    details: violationData.details || "",
                    timestamp: new Date(),
                    gameVersion: violationData.gameVersion || "unknown"
                }
            }
        },
        { upsert: true }
    );
    
    deviceCache.delete(deviceId);
    return { strikes, banned, message: banned ? "Device banned" : "Violation registered" };
}

async function getDeviceStatus(deviceId) {
    if (deviceCache.has(deviceId)) {
        return deviceCache.get(deviceId);
    }
    
    await connect();
    const data = await collection.findOne({ deviceId });
    
    if (!data) {
        const status = { exists: false, strikes: 0, banned: false };
        deviceCache.set(deviceId, status);
        return status;
    }
    
    const status = {
        exists: true,
        deviceId: data.deviceId,
        strikes: data.strikes || 0,
        banned: data.banned || false,
        lastHeartbeat: data.lastHeartbeat,
        lastViolationType: data.lastViolationType,
        gameVersion: data.gameVersion,
        platform: data.platform,
        createdAt: data._id.getTimestamp()
    };
    
    deviceCache.set(deviceId, status);
    return status;
}

async function saveIntegritySnapshot(deviceId, fileHashes) {
    await connect();
    const snapshot = createSnapshot();
    
    await collection.updateOne(
        { deviceId },
        { 
            $push: { 
                integritySnapshots: { 
                    $each: [{ 
                        ...snapshot,
                        fileHashes: fileHashes || {},
                        timestamp: new Date()
                    }], 
                    $slice: -SNAPSHOT_LIMIT 
                } 
            }
        },
        { upsert: true }
    );
    
    deviceCache.delete(deviceId);
}

async function getAnalytics() {
    await connect();
    
    const totalDevices = await collection.countDocuments();
    const bannedDevices = await collection.countDocuments({ banned: true });
    const recentViolations = await collection.countDocuments({ 
        lastHeartbeat: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    const topViolations = await collection.aggregate([
        { $match: { lastViolationType: { $ne: null } } },
        { $group: { _id: "$lastViolationType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]).toArray();
    
    return {
        totalDevices,
        bannedDevices,
        bannedPercentage: totalDevices > 0 ? (bannedDevices / totalDevices * 100).toFixed(2) : 0,
        recentViolations,
        topViolations
    };
}

async function resetDevice(deviceId) {
    await connect();
    
    await collection.updateOne(
        { deviceId },
        {
            $set: {
                strikes: 0,
                banned: false,
                bannedAt: null,
                lastViolationType: null,
                lastViolationDetails: null
            }
        }
    );
    
    deviceCache.delete(deviceId);
}

async function cleanup() {
    if (client) {
        await client.close();
    }
}

module.exports = {
    getConfig,
    processHeartbeat,
    registerViolation,
    getDeviceStatus,
    saveIntegritySnapshot,
    getAnalytics,
    resetDevice,
    cleanup
};