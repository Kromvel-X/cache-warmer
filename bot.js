/**
 * A Telegram bot that allows users to run a cache warm-up process.
 * It fetches URLs from a sitemap index, warms them up using Puppeteer,
 * and logs any errors encountered.
 * The bot responds to the /run_cache_warm command and provides feedback on the process.
 */

import { Telegraf } from 'telegraf'
import { Input } from 'telegraf';
import { Markup } from 'telegraf';
import { message } from 'telegraf/filters'
import { runCacheWarm } from './cache-warm.js';
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';

// Load environment variables from .env file
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);// Replace with your bot token from BotFather
const app = express();// Create an Express application to handle webhooks
const adminChatId = process.env.ADMIN_CHAT_ID; // Replace with your admin chat ID
let isRunning = false;// Flag to check if the warm-up is already running
let lastRunTimestamp = 0;// Timestamp of the last run to prevent multiple runs in a short time

bot.use((ctx, next) => {
  console.log('-------------------------------------');
  console.log('Update Type:', ctx.updateType);
  console.log('Update ID:', ctx.update?.update_id);
  console.log('Message:', ctx.message?.text || '[no message]');
  return next();
});

/**
 * Handles the /start command.
 * It sends a welcome message to the user and provides a button to run the cache warm-up
 * @param {Object} ctx - The context object provided by Telegraf.
 * @returns {Promise<void>}
 */
bot.command("start", async (ctx) => {
  // Prevent repeated execution if update has already been processed
  if (!ctx.message || ctx.message.entities?.[0]?.type !== "bot_command") return;
  console.log(`[BOT] User ${ctx.from.id} explicitly typed /start`);

  await ctx.reply(
    "Welcome to the Cache Warm-up Bot!\nUse the command /run_cache_warm to start warming up the cache.",
    Markup.keyboard(["/run_cache_warm"]).oneTime().resize()
  );
});

/**
 * Handles the /run_cache_warm command.
 * It initiates the cache warm-up process and sends a message to the user with the results.
 * If the warm-up is already running, it informs the user to wait.
 * @param {Object} ctx - The context object provided by Telegraf.
 * @returns {Promise<void>}
*/
bot.command('run_cache_warm', async (ctx) => {
    const now = Date.now();
    if (isRunning || now - lastRunTimestamp < 5000) { // защита от повторов в 5 секунд
        return await ctx.reply('⚠️  The warm-up is already underway. \nPlease wait for it to finish.');
    }
    isRunning = true;
    lastRunTimestamp = now;
    
    console.log(`[BOT] isRunning set to TRUE by user ${ctx.from.id}`);

    const userID = ctx.message.from.id;
    var message = await ctx.reply("🚀 Cache warm-up running \n⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 0%");
    let lastProgressText = ""; 

    /**
     * 
     * Handles the progress of the cache warm-up.
     * It updates the progress bar and sends the updated message to the user.
     * @param {number} processed - The number of URLs processed.
     * @param {number} total - The total number of URLs to process.
     * @returns {Promise<void>}
     */
    const onProgress = async (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      const bars = Math.round(percent / 10);
      const progressBar = "🟩".repeat(bars) + "⬜".repeat(10 - bars);

      var newText = `🚀 Cache warm-up running \n ${progressBar} ${percent}%`;

      if (newText === lastProgressText) return;
      lastProgressText = newText;

      try {
        await ctx.telegram.editMessageText(
          message.chat.id,
          message.message_id,
          undefined,
          newText
        );
      } catch (e) {
        console.error(`❌ Error updating progress: ${e.message}`);
      }
    };

    await ctx.telegram.sendMessage(adminChatId, `User ${userID} running a cache warmup.`);

    (async () => {
        try {
          const { totalUrls, successCount, totalWorkTime, errors } = await runCacheWarm(10, true, onProgress);

          let errorMessage = '';
          if (errors.length > 10) {
              errorMessage = `⚠️ Found ${errors.length} errors. The full list is written to the sent log file.`;
              const logPath = saveErrorsToLog(errors);
              await ctx.replyWithDocument(Input.fromLocalFile(logPath));
              await ctx.telegram.sendDocument(adminChatId, Input.fromLocalFile(logPath));
          } else if (errors.length) {
              errorMessage = `❗ Errors:\n${errors.join('\n')}`;
              const logPath = saveErrorsToLog(errors);
              await ctx.telegram.sendDocument(adminChatId, Input.fromLocalFile(logPath));
          } else {
            errorMessage= '✅ No errors';
          }

          const message =
              `✅ Warm-up complete!\n` +
              `🔗 Total URLs: ${totalUrls}\n` +
              `✅ Successfully “warmed up” URLs: ${successCount}\n` +
              `🕒 Time spent: ${totalWorkTime} min\n` +
              `${errorMessage}`;

          await ctx.reply(message);
          await ctx.telegram.sendMessage(adminChatId, message + `,\n user: ${userID}`);
      } catch (e) {
          await ctx.reply(`❌ Error: ${e.message}`);
          await ctx.telegram.sendMessage(adminChatId, `❌ Error: ${e.message}, user: ${userID}`);
      } finally {
          isRunning = false;
          console.log(`[BOT] isRunning reset to FALSE`);
      }
    })();
});

/**
 * Handles incoming text messages.
 * It sends a message to the user with instructions on how to use the bot.
 * @param {Object} ctx - The context object provided by Telegraf.
 * @returns {Promise<void>}
 */
bot.on(message('text'), async (ctx) => {
 if (ctx.message.entities?.some(e => e.type === 'bot_command')) return;
  await ctx.reply(
		"To work with the bot, use the command /run_cache_warm",
		Markup.keyboard(["/run_cache_warm"]).oneTime().resize(),
    );
});

/**
 * Handles errors that occur during the bot's operation.
 * It logs the error and sends a message to the user and admin.
 * @param {Error} err - The error object.
 * @param {Object} ctx - The context object provided by Telegraf.
 * @returns {void}
 */
bot.catch((err, ctx) => {
  console.error(`❌ Telegraf error for update type ${ctx.updateType}`, err);
  ctx.reply(`⚠️ Internal error occurred: ${err.message}`).catch(() => {});
  
  // Sending to the administrator
  ctx.telegram.sendMessage(
    adminChatId,
    `❌ Bot crashed on update type ${ctx.updateType}\nError: ${err.message}`
  ).catch(() => {});
});

/**
 * Sets up the webhook for the bot.
 * The bot will listen for incoming updates at the specified domain and path.
 * The port is set to 3000, which should match your server configuration.
 * @returns {Promise<void>}
 */
app.use(await bot.createWebhook({
  domain: process.env.DOMAIN, // Use the domain from environment variables
  path: process.env.WEBHOOK_PATH, // Use the webhook path from environment variables
}));

/**
 * Handles incoming requests to the webhook path.
 * It processes the updates received from Telegram.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
app.listen(process.env.WEBHOOK_PORT || 3000, '0.0.0.0', () => {
  console.log(`✅ Express listening on port ${process.env.WEBHOOK_PORT || 3000}`)
});

/**
 * Saves errors to a log file.
 * @param {Array} errors - The array of error messages to save.
 * @returns {string} The path to the log file.
*/
function saveErrorsToLog(errors) {
  const logDir = process.env.LOG_DIR; // Use environment variable or default to './logs'
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${logDir}/warm-errors-${timestamp}.log`;

  fs.writeFileSync(filePath, errors.join('\n'), 'utf-8');
  return filePath;
}