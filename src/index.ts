import { Bot, CommandContext, Context, webhookCallback } from 'grammy';

const startCommandReply = `
Welcome to the Doctor Appointment Notification Bot! 🚑

This bot helps you stay updated with the latest available doctor appointments. Get notifications directly in Telegram as soon as new appointments become available.

Simply use the command /register to start receiving notifications about new appointment slots. If you wish to stop receiving notifications at any time, you can use the /unregister command.

For more information on how to use this bot, type /help.
`;

const helpCommandReply = `
Doctor Appointment Notification Bot - Command Help 📘

/start - Start interacting with the bot and see this welcome message again.
/register - Register to receive notifications about new doctor appointments.
/unregister - Stop receiving notifications about new appointments.
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
			bot.command('register', (ctx) => handleRegister(ctx, env));
			bot.command('unregister', (ctx) => handleUnregister(ctx, env));

			const cb = webhookCallback(bot, 'cloudflare-mod');
			return await cb(request);
		} catch (e) {
			if (e instanceof Error) return new Response(e.message);
			return new Response(`(${typeof e} - ${e}`);
		}
	},
};

async function handleRegister(ctx: CommandContext<Context>, env: Env) {
	const chatId = ctx.chat.id;
	const activeChatIds = await getActiveChatIds(env);
	if (!activeChatIds.includes()) {
		activeChatIds.push(chatId);
		await saveActiveChatIds(activeChatIds, env);
		await ctx.reply('You are now registered for updates.');
	} else {
		await ctx.reply('You are already registered for updates!');
	}
}

async function handleUnregister(ctx: CommandContext<Context>, env: Env) {
	const chatId = ctx.chat.id;
	const activeChatIds = await getActiveChatIds(env);
	const index = activeChatIds.indexOf(chatId);
	if (index > -1) {
		activeChatIds.splice(index, 1);
		await saveActiveChatIds(activeChatIds, env);
		return 'You are now unregistered from updates.';
	} else {
		return 'You are not registered for updates.';
	}
}

async function getActiveChatIds(env: Env) {
	const data = await env.STORAGE.get('active_chat_ids');
	return data ? JSON.parse(data) : [];
}

async function saveActiveChatIds(chatIds: string[], env: Env) {
	await env.STORAGE.put('active_chat_ids', JSON.stringify(chatIds));
}
