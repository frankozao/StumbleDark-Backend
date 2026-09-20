require("dotenv").config();
const express = require("express");
const Console = require("./ConsoleUtils");
const CryptoUtils = require("./CryptoUtils");
const SharedUtils = require("./SharedUtils");

const {
  BackendUtils,
  UserModel,
  UserController,
  RoundController,
  BattlePassController,
  EconomyController,
  AnalyticsController,
  FriendsController,
  NewsController,
  MissionsController,
  TournamentXController,
  MatchmakingController,
  TournamentController,
  SocialController,
  EventsController,
  AssetController,
  authenticate,
  errorControll,
  sendShared,
  OnlineCheck,
  VerifyPhoton,
  getAppId
} = require("./BackendUtils");

const AntiCheat = require("./AntiCheatUtils");
const { handlePartyUpdate } = require("./RoomUtils");

const app = express();
const Title = "StumbleDarkBackend " + process.env.version;
const PORT = process.env.PORT || 8080;

app.use(express.json());

function isMaintenanceEnabled() {
  return String(process.env.MAINTENANCE_MODE || "false").toLowerCase() === "true";
}

app.get("/api/maintenance", (req, res) => {
  res.status(200).json({
    maintenance: isMaintenanceEnabled(),
    message: process.env.MAINTENANCE_MESSAGE || "StumbleDark is currently under maintenance. Please try again later."
  });
});

function parseVersion(version) {
  if (!version) return [0];

  return String(version)
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map(part => {
      const match = part.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
}

function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  const length = Math.max(av.length, bv.length);

  for (let i = 0; i < length; i++) {
    const an = av[i] || 0;
    const bn = bv[i] || 0;

    if (an < bn) return -1;
    if (an > bn) return 1;
  }

  return 0;
}

app.get("/api/update-required", (req, res) => {
  const clientVersion = req.query.version || "0";
  const minimumVersion = process.env.MINIMUM_VERSION || "0";

  const updateRequired =
    compareVersions(clientVersion, minimumVersion) < 0;

  res.status(200).json({
    updateRequired,
    clientVersion: String(clientVersion),
    minimumVersion: String(minimumVersion),
    message:
      process.env.UPDATE_REQUIRED_MESSAGE ||
      "A new version of StumbleDark is required. Please update your game."
  });
});

app.get("/ban-status/:id", async (req, res) => {
  try {
    const identifier = req.params.id;

    if (!identifier) {
      return res.status(400).json({
        isBanned: false,
        reason: "",
        bannedAt: null
      });
    }

    const user = await UserModel.findByBanIdentifier(identifier);

    if (!user) {
      return res.status(200).json({
        isBanned: false,
        reason: "",
        bannedAt: null
      });
    }

    return res.status(200).json({
      isBanned: user.isBanned === true,
      reason: user.banReason || "",
      bannedAt: user.bannedAt || null
    });
  } catch (error) {
    console.error("Ban status error:", error);

    return res.status(500).json({
      isBanned: false,
      reason: "",
      bannedAt: null
    });
  }
});

app.use((req, res, next) => {
  if (!isMaintenanceEnabled()) {
    return next();
  }

  if (
    req.path === "/api/maintenance" ||
    req.path === "/api/update-required" ||
    req.path === "/api/v1/ping" ||
    req.path.startsWith("/ban-status/")
  ) {
    return next();
  }

  return res.status(503).json({
    maintenance: true,
    message:
      process.env.MAINTENANCE_MESSAGE ||
      "StumbleDark is currently under maintenance. Please try again later."
  });
});

app.use(express.static("public"));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }

  next();
});

app.use(authenticate);

const assetController = new AssetController();

class CrownController {
  static async updateScore(req, res) {
    try {
      const { deviceid, username, country } = req.body;

      if (!deviceid || !username) {
        return res.status(400).json({ error: "Missing fields" });
      }

      let user = await UserModel.findByDeviceId(deviceid);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const newCrowns = (user.crowns || 0) + 1;

      await UserModel.update(user.stumbleId, {
        crowns: newCrowns
      });

      res.json({
        success: true,
        crowns: newCrowns
      });
    } catch (err) {
      console.error("Error updating crowns:", err);
      res.status(500).json({
        error: "Internal server error"
      });
    }
  }

  static async list(req, res) {
    try {
      const { country, start, count } = req.query;

      const data = await UserModel.GetHighscore(
        "crowns",
        country || "",
        start || 0,
        count || 50
      );

      res.json(data);
    } catch (err) {
      console.error("Error fetching crown highscores:", err);
      res.status(500).json({
        error: "Internal server error"
      });
    }
  }
}

app.post("/photon/auth", VerifyPhoton);
app.get("/photon/get", getAppId);
app.get("/onlinecheck", OnlineCheck);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get(
  "/matchmaking/filter",
  MatchmakingController.getMatchmakingFilter
);

app.post("/user/login", UserController.login);
app.get("/user/config", sendShared);
app.get("/usersettings", UserController.getSettings);
app.post("/user/updateusername", UserController.updateUsername);
app.get("/user/deleteaccount", UserController.deleteAccount);
app.post("/user/linkplatform", UserController.linkPlatform);
app.post("/user/unlinkplatform", UserController.unlinkPlatform);
app.get("/shared/:version/:type", sendShared);
app.post("/user/profile", UserController.getProfile);
app.post(
  "/user-equipped-cosmetics/update",
  UserController.updateCosmetics
);
app.post(
  "/user/cosmetics/addskin",
  UserController.addSkin
);
app.post(
  "/user/cosmetics/setequipped",
  UserController.setEquippedCosmetic
);

app.get(
  "/round/finish/:round",
  RoundController.finishRound
);
app.get(
  "/round/finishv2/:round",
  RoundController.finishRound
);
app.post(
  "/round/finish/v4/:round",
  RoundController.finishRoundV4
);
app.post(
  "/round/eventfinish/v4/:round",
  RoundController.finishRoundV4
);

app.get(
  "/battlepass",
  BattlePassController.getBattlePass
);
app.post(
  "/battlepass/claimv3",
  BattlePassController.claimReward
);
app.post(
  "/battlepass/purchase",
  BattlePassController.purchaseBattlePass
);
app.post(
  "/battlepass/complete",
  BattlePassController.completeBattlePass
);

app.get(
  "/economy/purchase/:item",
  EconomyController.purchase
);
app.get(
  "/economy/purchasegasha/:itemId/:count",
  EconomyController.purchaseGasha
);
app.get(
  "/economy/purchaseluckyspin",
  EconomyController.purchaseLuckySpin
);
app.get(
  "/economy/purchasedrop/:itemId/:count",
  EconomyController.purchaseLuckySpin
);
app.post(
  "/economy/:currencyType/give/:amount",
  EconomyController.giveCurrency
);

app.get("/missions", MissionsController.getMissions);
app.post(
  "/missions/:missionId/rewards/claim/v2",
  MissionsController.claimMissionReward
);
app.post(
  "/missions/objective/:objectiveId/:milestoneId/rewards/claim/v2",
  MissionsController.claimMilestoneReward
);

app.post(
  "/friends/request/accept",
  FriendsController.add
);
app.delete(
  "/friends/:UserId",
  FriendsController.remove
);
app.get(
  "/friends",
  FriendsController.list
);
app.post(
  "/friends/search",
  FriendsController.search
);
app.post(
  "/friends/request",
  FriendsController.request
);
app.post(
  "/friends/accept",
  FriendsController.accept
);
app.post(
  "/friends/request/decline",
  FriendsController.reject
);
app.post(
  "/friends/cancel",
  FriendsController.cancel
);
app.get(
  "/friends/request",
  FriendsController.pending
);

app.get(
  "/game-events/me",
  EventsController.getActive
);

app.get(
  "/news/getall",
  NewsController.GetNews
);

app.post(
  "/analytics",
  AnalyticsController.analytic
);

app.post(
  "/update-crown-score",
  CrownController.updateScore
);

app.get(
  "/highscore/crowns/list",
  CrownController.list
);

app.get(
  "/highscore/:type/list/",
  async (req, res, next) => {
    try {
      const { type } = req.params;
      const {
        start = 0,
        count = 100,
        country = "global"
      } = req.query;

      const startNum = parseInt(start, 10);
      const countNum = parseInt(count, 10);

      if (!type) {
        return res.status(400).json({
          error: "O tipo é necessário"
        });
      }

      if (isNaN(startNum) || isNaN(countNum)) {
        return res.status(400).json({
          error:
            "Os parâmetros start e count devem ser números"
        });
      }

      const result = await UserModel.GetHighscore(
        type,
        country,
        startNum,
        countNum
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

app.get(
  "/social/interactions",
  SocialController.getInteractions
);

app.get(
  "/tournamentx/active",
  TournamentXController.getActive.bind(TournamentXController)
);

app.get(
  "/tournamentx/active/v2",
  TournamentXController.getActive.bind(TournamentXController)
);

app.post(
  "/tournamentx/:tournamentId/join/v2",
  TournamentXController.join.bind(TournamentXController)
);

app.post(
  "/tournamentx/:tournamentId/leave",
  TournamentXController.leave.bind(TournamentXController)
);

app.post(
  "/tournamentx/:tournamentId/finish",
  TournamentXController.finish.bind(TournamentXController)
);

app.get("/api/v1/ping", async (req, res) => {
  res.status(200).send("OK");
});

app.post(
  "/api/v1/userLoginExternal",
  TournamentController.login
);

app.get(
  "/api/v1/tournaments",
  TournamentController.getActive
);

app.get("/download-assets", async (req, res) => {
  try {
    const assets = {
      version: "2.10.4",
      photonVersion: "1.4.15",
      serverAddress: `${req.get("host")}`,
      timestamp: new Date().toISOString(),
      downloadSize: 73031680,
      assets: [
        {
          id: "unity-bundle",
          type: "bundle",
          version: "2.10.4",
          platform: "android",
          url: `${req.protocol}://${req.get("host")}/assets/android/main.bundle`,
          size: 73031680,
          checksum: "abc123"
        },
        {
          id: "unity-bundle",
          type: "bundle",
          version: "2.10.4",
          platform: "ios",
          url: `${req.protocol}://${req.get("host")}/assets/ios/main.bundle`,
          size: 73031680,
          checksum: "abc123"
        },
        {
          id: "app-config",
          type: "config",
          version: "2.10.4",
          platform: "all",
          url: `${req.protocol}://${req.get("host")}/assets/config.json`,
          size: 1024,
          checksum: "def456"
        }
      ]
    };

    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error("Download assets error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch asset manifest"
    });
  }
});

app.get(
  "/api/assets/version",
  (req, res) => assetController.checkVersion(req, res)
);

app.get(
  "/api/assets/manifest",
  (req, res) => assetController.getManifest(req, res)
);

app.get(
  "/api/assets/download/:assetId",
  (req, res) => assetController.downloadAsset(req, res)
);

app.post(
  "/api/assets/verify",
  (req, res) => assetController.verifyAsset(req, res)
);

app.post(
  "/api/assets/complete",
  (req, res) => assetController.completeDownload(req, res)
);

app.post(
  "/api/assets/admin/update-version",
  (req, res) => assetController.updateVersion(req, res)
);

app.get(
  "/api/assets/admin/config",
  (req, res) => assetController.getConfig(req, res)
);

app.post(
  "/api/assets/admin/config",
  (req, res) => assetController.updateConfig(req, res)
);

app.get(
  "/api/assets/admin/logs",
  (req, res) => assetController.getLogs(req, res)
);

app.post("/party/update", handlePartyUpdate);

app.get("/anticheat/config", (req, res) => {
  const config = AntiCheat.getConfig();
  res.status(200).json(config);
});

app.post("/anticheat/heartbeat", (req, res) => {
  try {
    const deviceId = req.body.deviceId;
    const heartbeatData = req.body.data;

    AntiCheat.processHeartbeat(deviceId, heartbeatData)
      .then(response => res.status(200).json(response))
      .catch(error => {
        Console.error(
          "anticheat",
          "Heartbeat error:",
          error
        );

        res.status(500).json({
          error: "Heartbeat failed"
        });
      });
  } catch (error) {
    Console.error(
      "anticheat",
      "Heartbeat error:",
      error
    );

    res.status(500).json({
      error: "Heartbeat failed"
    });
  }
});

app.post("/anticheat/report", (req, res) => {
  try {
    const {
      deviceId,
      violationType,
      details,
      gameVersion,
      platform
    } = req.body;

    AntiCheat.registerViolation(deviceId, {
      type: violationType,
      details,
      gameVersion,
      platform
    })
      .then(result => res.status(200).json(result))
      .catch(error => {
        Console.error(
          "anticheat",
          "Report error:",
          error
        );

        res.status(500).json({
          error: "Report failed"
        });
      });
  } catch (error) {
    Console.error(
      "anticheat",
      "Report error:",
      error
    );

    res.status(500).json({
      error: "Report failed"
    });
  }
});

app.get("/anticheat/status/:deviceId", (req, res) => {
  try {
    const { deviceId } = req.params;

    AntiCheat.getDeviceStatus(deviceId)
      .then(status => res.status(200).json(status))
      .catch(error => {
        Console.error(
          "anticheat",
          "Status error:",
          error
        );

        res.status(500).json({
          error: "Status check failed"
        });
      });
  } catch (error) {
    Console.error(
      "anticheat",
      "Status error:",
      error
    );

    res.status(500).json({
      error: "Status check failed"
    });
  }
});

app.post("/anticheat/integrity", (req, res) => {
  try {
    const { deviceId, fileHashes } = req.body;

    AntiCheat.saveIntegritySnapshot(
      deviceId,
      fileHashes
    )
      .then(() =>
        res.status(200).json({
          success: true
        })
      )
      .catch(error => {
        Console.error(
          "anticheat",
          "Integrity error:",
          error
        );

        res.status(500).json({
          error: "Integrity check failed"
        });
      });
  } catch (error) {
    Console.error(
      "anticheat",
      "Integrity error:",
      error
    );

    res.status(500).json({
      error: "Integrity check failed"
    });
  }
});

app.get("/admin/anticheat/analytics", (req, res) => {
  try {
    const adminKey = req.query.key;

    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    AntiCheat.getAnalytics()
      .then(analytics =>
        res.status(200).json(analytics)
      )
      .catch(error => {
        Console.error(
          "anticheat",
          "Analytics error:",
          error
        );

        res.status(500).json({
          error: "Analytics failed"
        });
      });
  } catch (error) {
    Console.error(
      "anticheat",
      "Analytics error:",
      error
    );

    res.status(500).json({
      error: "Analytics failed"
    });
  }
});

app.post(
  "/admin/anticheat/reset/:deviceId",
  (req, res) => {
    try {
      const { deviceId } = req.params;
      const { adminKey } = req.body;

      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({
          error: "Unauthorized"
        });
      }

      AntiCheat.resetDevice(deviceId)
        .then(() =>
          res.status(200).json({
            success: true,
            message: "Device reset"
          })
        )
        .catch(error => {
          Console.error(
            "anticheat",
            "Reset error:",
            error
          );

          res.status(500).json({
            error: "Reset failed"
          });
        });
    } catch (error) {
      Console.error(
        "anticheat",
        "Reset error:",
        error
      );

      res.status(500).json({
        error: "Reset failed"
      });
    }
  }
);

app.use(errorControll);

app.listen(PORT, () => {
  const currentDate = new Date()
    .toLocaleString()
    .replace(",", " |");

  console.clear();

  Console.log(
    "Server",
    `[${Title}] | ${currentDate} | ${CryptoUtils.SessionToken()}`
  );

  Console.log(
    "Server",
    `Listening on port ${PORT}`
  );

  Console.log(
    "AntiCheat",
    "Anti-Cheat System: ACTIVE ✓"
  );

  Console.log(
    "AssetSystem",
    "Asset Update System: ACTIVE ✓"
  );
});