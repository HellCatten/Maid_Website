const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=1`, {
  headers: { Authorization: `Bot ${token}` }
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));