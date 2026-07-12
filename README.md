<h1 align = 'center'>
    <img 
        src="https://github.com/user-attachments/assets/1fc07002-38c4-4bd5-aad2-18846411969e"
        height = '100' 
        width = '100' 
        alt = "Scenic Infinite Rail mode icon"
    >
    <br>
    Scenic Infinite Rail Mode
    <br>
    <sub>For Minecraft</sub>
</h1>

## What is it?
A vanilla Minecraft data pack that creates an **endless minecart ride through the world**, following the terrain in a smoothed camera seat.

The idea is that you can **leave it running on a TV or monitor** as visual ambiance. 

Basically the Minecraft equivalent of "[Slow TV](https://en.wikipedia.org/wiki/Slow_television)", such as 4-8 hour train ride videos on YouTube or Netflix.

<br>

<p align="center"><img width="700" height="424" src="https://github.com/user-attachments/assets/fa993467-88cf-4300-bfca-ecb26a0104d3" /></p>

<br>

## What it's _not_

### **Not for multiplayer servers or existing worlds:**
  * This is a standalone "mode", not utility. (It's not for building rail from one place to another)
  * It automatically locks the player into a seat as soon as you join the world, and keeps you there.
  * It also manually controls the cart and player movements, and force loads/unloads chunks in front and behind.

--------

## <img src=".github/assets/download-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/download-dark.svg#gh-dark-mode-only" width="22" align="center" /> How to Download

**Both Java and Bedrock Editions supported**

1. Go to the Releases page.
2. For the latest release, look under Assets, then download either:
    - For **Java Edition**: `ScenicInfiniteRailMode-Java-*.zip` 
    - For **Bedrock Edition**: `ScenicInfiniteRailMode-Bedrock-*.mcaddon` 
3. For **installation steps**, see the [How To Install](#how-to-install) section further down.

# <img src=".github/assets/help-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/help-dark.svg#gh-dark-mode-only" width="28" align="center" /> How to Use

### **Starting the Ride:**
The ride starts automatically for the first player in a new world. (It was designed and intended for single player worlds)

## Hotbar Control Items

<h3><p align="center">Bedrock:</p></h3>
<p align="center"><img width="550" alt="Bedrock Hotbar control items" src="https://github.com/user-attachments/assets/b733444a-1e68-4710-a140-253e706e09f7" /></p>
<h3><p align="center">Java:</p></h3>
<p align="center"><img width="560" alt="Java Hotbar control items" src="https://github.com/user-attachments/assets/9b0e7e83-06b4-4382-8a12-781ea255e937" /></p>

<p align="center">1: Ride Settings -- 2: Visual Settings -- 3: Toggle HUD* -- 4-6: Speed controls -- 8: Tips -- 9: Debug</p>

<p align="center"><sub>*Toggle HUD is really only necessary on Bedrock Edition for consoles. With a keyboard, F1 can be used instead.</sub></p>

### **Ride Settings**:
  * **Sky mode** (On/Off): If enabled, the ride goes high up into the sky instead of ground level. **Default = Off**
  * **Cart Sound** (On/Off): Whether the cart sound is heard or silent. **Default = On**
  * **Show Cart** (Show/Hide): Whether you can see the cart or not. **Default = Show**
  * **Mobs Aggro** (On/Off): Mobs make noise and approach the player. **Default = On**

###  **Visual Settings**: 
  * **Rain** (On/Off): If enabled, it's always raining. If disabled, normal weather cycle. (Default = Off)
  * **Time** (Night/Day/Default): Optionally force a time of day. If "Default", normal day/night cycle.
  * **Torches** (Auto/On/Off): Adds torches randomly around the track. If Auto, they only appear at night. (Default = Auto)
  * **Torch Density** (Low/Medium/High/Max): How many torches to add, if enabled. (Default = Medium)

###  **Speed Control Items:** 
  * **Speed +**
  * **Speed -** 
  * **Speed Reset**

### **Other Items:**
  * **Toggle HUD** (Bedrock Only): Hides the HUD except for the item-name popup.
     * Mostly useful for Console version. On PC, you can simply use the F1 key to toggle the HUD.
  * **Tips:** Provides recommended game and video settings.
  * **Debug:** Provides access to the debug chat toggle, sidebar views, and command help.

## <img src=".github/assets/balance-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/balance-dark.svg#gh-dark-mode-only" width="28" align="center" /> Java vs Bedrock Editions

Because of platform differences, the Java and Bedrock versions have visual differences, but the ride logic and settings are mostly identical.

### **Differences With the Datapack Itself:**
- Bedrock version has some custom item icons
- Bedrock version has a "Toggle HUD" item (see other sections for why)
- Bedrock version uses Native menus, Java uses clickable text in books

### **General Bedrock Advantages:**
- Currently, the "vibrant visuals" option is only in Bedrock edition (though will [eventually come to Java](https://www.minecraft.net/en-us/article/another-step-towards-vibrant-visuals-for-java-edition))
- Bedrock is the only option to run on a console, like if you want to put this on your TV

### **Major Bedrock Drawbacks**

**❌ Problem:** On console, you can't load custom behavior packs.

**ℹ️ Workaround:** Download the world through a realm.
  - The only way to use a custom behavior pack on a console for a local world is to host a realm with it, then download it onto the console.
  - See the "[Console Installation](#console-installation-via-realms)" section below.

  
**❌ Problem:** Bedrock apparently has a hardcoded "AFK" message that dims the screen and cannot be disabled. After 15 minutes, it says "You've been away for a bit..."

**ℹ️ Workaround:** Some kind of automated input.
   - On PC, use software that automatically sends inputs so you don't go AFK.
   - On Console, a third-party controller with a mode that can automatically repeat inputs forever. This feature may be called "Turbo Hold", "Auto Burst", "Auto Turbo", or "Auto-Pilot".
     - For example, select the empty item slot and have it repeatedly send Left Trigger, which would do nothing.


# <img src=".github/assets/system_update-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/system_update-dark.svg#gh-dark-mode-only" width="28" align="center" /> How to Install

#### Supported Versions:
- **Java Edition:** Version 1.21.9 through 26.2
- **Bedrock Edition:** Requires 1.21.120 or newer; tested on 26.33

 ## **Java Edition Installation:**
 1. During creation of a Single Player world, click the "More" tab, then the "Data Packs" button.
 2. Drag and drop the downloaded `ScenicInfiniteRailMode-Java-*.zip` file onto the Minecraft window (no need to extract). Select "Yes" if it asks to confirm.
     - In the "Available" list you should now see the newly added data pack 
 3. Important: You must activate the data pack by hovering over its icon on the left, and clicking the "Play button" that appears while hovering.
     - The "ScenicInfiniteRailMode-Java" data pack should now show in the "Selected" list.
 4. Click "Done".
     - It may show a warning about experimental features. Click "Proceed".
 5. Finish creating the world.
     - You can name it whatever, and the default settings are fine.

 ## **Bedrock Edition Installation:** 
  1. Close minecraft if it's already running _(important)_.
  2. Double click the `.mcaddon` file.
    - It may ask which program to open with. Select "Minecraft" (or "Minecraft For Windows").
  3. Minecraft should launch, and after a few seconds should say "Successfully imported Scenic Infinite Rail Mode" at the top.
  4. While creating a new single player world, go to the "Behavior packs" tab, and click "Activate" next to Scenic Infinite Rail Mode
     - It should automatically also activate the related Resource Pack after activating the Behavior Pack.
  5. Finish creating the world.
     - You can name it whatever, and the default settings are fine.
     - It will give a warning about achievements, just click "Create Anyway"

## **Console Installation (via Realms):**
**Consoles cannot directly load custom behavior packs**. To play on a console, you must create a Realm with the pack installed from a PC, then download that world onto your console. You can use the free Realms trial for this.

 1. On a device where you can download files (PC/Mobile), sign up for the **Realms trial**.
 2. Create a new world. Go to the "Behavior Packs" tab and activate "Scenic Infinite Rail Mode".
 3. Click **"Create on Realms"** and select an available Realms slot.
 4. *Note:* Sometimes Realms fail to activate the pack on the first try, or textures might not load even if the resource pack is activated. To ensure it is working:
    - Back out to the main menu. Go to **Play** > **Realms** > **Realms Hub** > **"World" tab**.
    - Select your new world and click **"Edit world"**.
    - Go to **Behavior packs** *again* and activate it if not already. Select "Add the pack anyway".
    - Click **Play** and save changes if asked. Once you load in, the mod should be active. If the textures weren't loaded, leaving and rejoining should fix that too.
 5. Now, log into Minecraft on your **console** and go to the Realms hub.
 6. Click the 3 dots next to your Realm and select **"Download world"**. You now have a local copy and no longer need the active Realm.
 7. **Tip:** Make a duplicate copy of this local world as a backup right at the start. Because the game saves your position when you leave and rejoin, a backup lets you easily start fresh from the beginning later.

Note: There are other non-official workarounds you can search for, but they can be advanced or involve third party apps that don't last long, so you'll have to look that up yourself.

-------------------

# <img src=".github/assets/folder_code-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/folder_code-dark.svg#gh-dark-mode-only" width="28" align="center" /> Advanced / Manual Configuration

* **To force start/stop the ride**, you can use these function commands (cheats / commands must be enabled):
    * Java: `/function infinite_rail:start` and  `/function infinite_rail:stop`
    * Bedrock: `/function infinite_rail/start` and  `/function infinite_rail/stop`

* **Advanced Configuration:**
  * The modes and ride settings can be changed in-game using the various item tools in the hotbar. However, for additional advanced tweaking, you can edit the values in the `config.mcfunction` file.
     * You'll need to `/reload` if changing values by editing the file.
  * Alternatively, you can run `/scoreboard` commands for the config settings, and most should update on the fly in game.
    - You'll notice that in `config.mcfunction`, the lines defining the settings values are simply `scoreboard` commands. You can copy the entire line and paste it after a `/` in chat and it will update it right away.
      - For example: `scoreboard players set .TUNNELCLEAR cfg_terrain 6`
    - To make it permanent you'll need to update the value in file 
    

## Building From Source
This repository is a monorepo containing shared logic and edition-specific files.

There's also a `Make-Symlinks.ps1` powershell script in the `tools` folder, which will automatically create combined directories in a `dist_links` folder.
  - For Bedrock you can symlink the `_BP` and `_RP` folders in `development_behavior_packs` and `development_resource_packs` respectively.
  - For Java, you can drag the `_Java` folder into the Data Packs window to create a new world with the combined java build.
  - You'll probably have to re-run the `.ps1` script if you make any changes that add a new file.

**Recommended:** The repository has a build script as a GitHub workflow action. You can simply fork the repo and it should make new build artifacts on every commit.

**For building locally:**
1. Ensure a JavaScript runtime (Node.js) is available.
2. Execute `node tools/build.mjs` from the repository root to assemble the packs.
3. The build script aggregates shared functions from `src/shared/functions/` and edition-specific files to generate the distribution folders.

