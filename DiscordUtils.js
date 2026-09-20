// Discord Utilities
// Placeholder for Discord integration

const DiscordUtils = {
  sendMessage: (message) => {
    // Placeholder - implement Discord webhook if needed
    console.log('[Discord]', message);
  },

  sendEmbed: (embed) => {
    // Placeholder - implement Discord webhook if needed
    console.log('[Discord Embed]', embed);
  },

  notifyRoomCreated: (roomData) => {
    console.log('[Discord] Room created:', roomData);
  },

  notifyPlayerJoined: (playerData) => {
    console.log('[Discord] Player joined:', playerData);
  },

  notifyError: (error) => {
    console.error('[Discord] Error:', error);
  }
};

module.exports = DiscordUtils;
