import { Bot, CommandContext, Context, webhookCallback } from 'grammy';

type NotificationsRegisteredRow = {
    chat_id: number;
    item_key_index: string;
}

const startCommandReply = `
Welcome to the Doctor Appointment Notification Bot! 🚑

This bot helps you stay updated with the latest available doctor appointments. Get notifications directly in Telegram as soon as new appointments become available.

Simply use the command /register to start receiving notifications about new appointment slots. If you wish to stop receiving notifications at any time, you can use the /unregister command.

For more information on how to use this bot, type /help.
`;

const helpCommandReply = `
Doctor Appointment Notification Bot - Command Help 📘

/start - Start interacting with the bot and see this welcome message again.
/register [SERGUIDE_LINK] - Register to receive notifications about new doctor appointments.
/unregister [SERGUIDE_LINK] - Stop receiving notifications about new appointments.
/help - Get detailed information about the available bot commands and how to use them.

Just follow the instructions, and I'll handle the rest for you! If you have any questions or encounter any issues, feel free to reach out through this chat.
`;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const botInfo = JSON.parse(env.BOT_INFO);
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN, { botInfo });

			bot.command('start', (ctx) => ctx.reply(startCommandReply));
			bot.command('help', (ctx) => ctx.reply(helpCommandReply));
			bot.command('register', async (ctx) => ctx.reply(await handleRegister(ctx, env)));
			bot.command('unregister', async (ctx) => ctx.reply(await handleUnregister(ctx, env)))

			const cb = webhookCallback(bot, 'cloudflare-mod');
			return await cb(request);
		} catch (e) {
			if (e instanceof Error) return new Response(e.message);
			return new Response(`(${typeof e} - ${e}`);
		}
	},
};

async function handleRegister(ctx: CommandContext<Context>, env: Env): Promise<string> {
	const chatId = ctx.chat.id;
	const item = ctx.match;
	if (item === undefined) {
		return 'Please pass a SERGUIDE_LINK to the command to register for that doctor.';
	}
	const itemKeyIndex = extractItemKeyIndex(item);
	if (itemKeyIndex === '') {
		return 'Unable to extract info from the supplied link. Make sure to pass a link from serguide.maccabi4u.co.il';
	}
	const activeChatIds = await getChatIdsForItemKeyIndex(itemKeyIndex, env);
	if (!activeChatIds.includes(chatId)) {
		await addChatIdForItemKeyIndex(chatId, itemKeyIndex, env);
		return 'You are now registered for updates for the specified doctor';
	} else {
		return 'You are already registered for updates for the specified doctor!';
	}
}

async function handleUnregister(ctx: CommandContext<Context>, env: Env): Promise<string> {
	const chatId = ctx.chat.id;
	const item = ctx.match;
	if (item === undefined) {
		return 'Please pass a SERGUIDE_LINK to the command to unregister for that doctor.';
	}
	const itemKeyIndex = extractItemKeyIndex(item);
	if (itemKeyIndex === '') {
		return 'Unable to extract info from the supplied link. Make sure to pass a link from serguide.maccabi4u.co.il';
	}
	const activeChatIds = await getChatIdsForItemKeyIndex(itemKeyIndex, env);
	if (activeChatIds.includes(chatId)) {
		await removeChatIdForItemKeyIndex(chatId, itemKeyIndex, env);
		return 'You are now unregistered from updates for the specified doctor.';
	} else {
		return 'You are not registered for updates for the specified doctor.';
	}
}

async function getChatIdsForItemKeyIndex(itemKeyIndex: string, env: Env): Promise<number[]> {
	try {
		const stmt = env.DB.prepare('SELECT chat_id FROM notifications_registered WHERE item_key_index = ?').bind(itemKeyIndex);
		const { results, success } = await stmt.all<NotificationsRegisteredRow>();
		if (!success) {
			console.log("Unknown error executing SQL query in getChatIdsForItemKeyIndex");
			return [];
		}
		return results.map(result => result.chat_id)
	} catch (e) {
		if (e instanceof Error)
			console.error(`Error executing SQL query in getChatIdsForItemKeyIndex - ${e.message}`);
		return [];
	}
}

async function addChatIdForItemKeyIndex(chatId: number, itemKeyIndex: string, env: Env) {
	try {
		const stmt = env.DB.prepare('INSERT INTO notifications_registered (chat_id, item_key_index) VALUES = (?, ?)').bind(chatId, itemKeyIndex);
		const { success } = await stmt.run();
		if (!success) {
			console.log("Unknown error executing SQL query in addChatIdForItemKeyIndex");
		}
		return;
	} catch (e) {
		if (e instanceof Error)
			console.error(`Error executing SQL query in addChatIdForItemKeyIndex - ${e.message}`);
		return;
	}
}

async function removeChatIdForItemKeyIndex(chatId: number, itemKeyIndex: string, env: Env) {
	try {
		const stmt = env.DB.prepare('DELETE FROM notifications_registered WHERE chat_id = ? AND item_key_index = ?').bind(chatId, itemKeyIndex);
		const { success } = await stmt.run();
		if (!success) {
			console.log("Unknown error executing SQL query in removeChatIdForItemKeyIndex");
		}
		return;
	} catch (e) {
		if (e instanceof Error)
			console.error(`Error executing SQL query in removeChatIdForItemKeyIndex - ${e.message}`);
		return;
	}
}

function extractItemKeyIndex(link: string): string{
	try {
		const url = new URL(link);
		const itemKeyIndex = url.searchParams.get('ItemKeyIndex');
		return itemKeyIndex ?? '';
	} catch(TypeError) {
		return '';
	}
}
