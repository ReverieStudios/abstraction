const DISCORD_TOKEN = import.meta.env.VITE_DISCORD_BOT_TOKEN;

function makeRequest(method: string, endpoint: string, data?: object) {
	return fetch(`https://discord.com/api/${endpoint}`, {
		method,
		headers: {
			Accept: 'application/json',
			Authorization: `Bot ${DISCORD_TOKEN}`,
			'Content-Type': 'application/json;charset=utf-8'
		},
		body: JSON.stringify(data)
	})
		.then((r) => r.json())
		.catch((err) => console.log({ endpoint, data, err }));
}

const getUserID = (serverID: string, name: string) =>
	makeRequest('GET', `/guilds/${serverID}/members/search?query=${name}`).then(
		(matches) => matches[0]?.user?.id
	);

const openConversation = (userID: string) =>
	makeRequest('POST', 'users/@me/channels', { recipient_id: userID });

const sendMessage = (channelID: string, content: string) =>
	makeRequest('POST', `channels/${channelID}/messages`, { content });

export const getMembers = (serverID: string) =>
	makeRequest('GET', `/guilds/${serverID}/members?limit=1000`);

export const getChannels = async (serverID: string) => {
	const channels = await makeRequest('GET', `guilds/${serverID}/channels`);
	return channels
		.filter((channel) => channel.type === 0)
		.map((channel) => ({ id: channel.id, name: channel.name }));
};

export const getMessages = async (channelID: string) => {
	const messages = await makeRequest('GET', `channels/${channelID}/messages?limit=5`);
	return messages.reverse();
};

export const postMessage = async (channelID: string, content: string) =>
	sendMessage(channelID, content);

export const sendDM = async (serverID: string, userName: string, content: string) => {
	const userID = await getUserID(serverID, userName);
	if (userID) {
		const newDM = await openConversation(userID);
		if (newDM?.id) {
			await sendMessage(newDM.id, content);
		}
	}
};
