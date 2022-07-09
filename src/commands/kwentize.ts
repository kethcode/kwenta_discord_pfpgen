require("dotenv").config();

import {
  BaseCommandInteraction,
  Client,
  GuildMember,
  GuildMemberRoleManager,
  MessageAttachment,
  Role,
} from "discord.js";
import { Command } from "../Command";

import { RemoveBgError, removeBackgroundFromImageUrl } from "remove.bg";

import { createCanvas, Image } from "@napi-rs/canvas";

import { readFile, unlink } from "fs/promises";

import https from "http";
import { createWriteStream } from "fs";

const path = require("path");

const path_back = path.resolve(
  __dirname,
  "../images/kwenta-pfp-border-background.png"
);
const path_topback = path.resolve(
  __dirname,
  "../images/kwenta-pfp-border-topback4.png"
);
const path_bottomfront = path.resolve(
  __dirname,
  "../images/kwenta-pfp-border-bottomfront3.png"
);

const width = 800;
const height = 800;

let limitUses = new Map<string, number>();

async function removeFromImgUrl(url: string, id: string) {
  const outputFile = `${__dirname}/../images/${id}.png`;
  try {
    const result = await removeBackgroundFromImageUrl({
      url,
      apiKey: process.env.REMOVE_BG_API_KEY ?? "",
      size: "auto",
      type: "auto",
      format: "png",
      outputFile,
    });

    console.log(`${result.creditsCharged} credit(s) charged for this image`);
    console.log(
      `Result width x height: ${result.resultWidth} x ${result.resultHeight}, type: ${result.detectedType}`
    );
    console.log(`File saved to ${outputFile}`);
    // console.log(result.base64img.substring(0, 40) + "..");
    // console.log(
    //   `Rate limit: ${result.rateLimit}, remaining: ${result.rateLimitRemaining}, reset: ${result.rateLimitReset}, retryAfter: ${result.retryAfter}`
    // );
  } catch (e) {
    //   const errors: Array<RemoveBgError> = e;
    //   console.log(JSON.stringify(errors));
	console.log("Error with remove.bg.  Using raw image.");

    const file = createWriteStream(outputFile);
    const request = https.get(url, function (response) {
      response.pipe(file);

      // after download completed close filestream
      file.on("finish", () => {
        file.close();
        console.log("Download Completed");
      });
    });

    // console.log(e);
  }

  return outputFile;
}

export const kwentize: Command = {
  name: "kwentize",
  description: "Generates a Kwenta-style PFP from your Discord Avatar",
  type: "CHAT_INPUT",
  run: async (client: Client, interaction: BaseCommandInteraction) => {
    try {
      let uses: number = 0;
      if (limitUses.has(interaction.user.id)) {
        uses = limitUses.get(interaction.user.id) || 0;
      }

      uses = uses + 1;
      limitUses.set(interaction.user.id, uses);

      let content: string = "";
      if (uses > 3) {
        content = "You have already used all 3/3 of your Kwentize PFP calls.";
        await interaction.followUp({
          ephemeral: true,
          content,
        });
        return;
      } else {
        content = `You have now used ${uses}/3 of your Kwentize PFP calls.`;
      }

      // Add Role
      const roleLeague = interaction.guild?.roles.cache.find(
        (r) => r.name === "The League"
      ) as Role;
      const member = interaction.member as GuildMember;
      member?.roles.add(roleLeague);

      // Draw New PFP
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      // Draw Background
      const background = await readFile(path_back);
      const backgroundImage = new Image();
      backgroundImage.src = background;
      context.drawImage(backgroundImage, 0, 0, width, height);

      // Draw Top Chevron
      const topback = await readFile(path_topback);
      const topbackImage = new Image();
      topbackImage.src = topback;
      context.drawImage(topbackImage, 0, 0, width, height);

      // Get the Avatar and Remove It's background
      const avatarURL = interaction.user.avatarURL({ format: "png" }) as string;
      //   console.log(avatarURL);
      const cleanedAvatarPath = await removeFromImgUrl(
        avatarURL,
        interaction.user.id
      );

      // Draw the Cleaned Avatar
      const avatar = await readFile(cleanedAvatarPath);
      const avatarImage = new Image();
      avatarImage.src = avatar;

      context.drawImage(
        avatarImage,
        width * 0.065,
        height * 0.065,
        width - width * 0.13,
        height - height * 0.13
      );

      // Draw the Front Chevron
      const bottomfront = await readFile(path_bottomfront);
      const bottomfrontImage = new Image();
      bottomfrontImage.src = bottomfront;
      context.drawImage(bottomfrontImage, 0, 0, width, height);

      // Build File Attachment
      const attachment = new MessageAttachment(
        canvas.toBuffer("image/png"),
        "kwenta-profile-image.png"
      );

      // Send File Attachemnt and Content Text
      await interaction.followUp({
        ephemeral: true,
        content,
        files: [attachment],
      });

      await unlink(cleanedAvatarPath);
    } catch (e) {
      console.log(e);
    }
  },
};
