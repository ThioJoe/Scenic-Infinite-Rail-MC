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

# What is it?

<h3 align="center">A standalone Minecraft pack for Java and Bedrock that creates an <ins>endless minecart ride</ins> across the world, following the terrain with smooth camera motion.</h3>

<h3 align="center">Leave it running all day on a TV or monitor as visual ambiance.</h3>

<h3 align="center"><em>No dependencies or mods required.</em></h3>

<br>

<p align="center"><img width="700" height="424" src="https://github.com/user-attachments/assets/fa993467-88cf-4300-bfca-ecb26a0104d3" /></p>

<p align="center">Basically the Minecraft equivalent of those 4-8 hour train ride videos on YouTube or Netflix (aka "Slow TV").</p>

<br>

## ⚠️ What it's _NOT_

### **Not for existing worlds or multiplayer servers:**
  * This is a standalone "mode", not a utility. (It's not for building rail from one place to another)
  * It automatically locks the player into a seat as soon as you join the world, and keeps you there.
  * It also manually controls the cart, destroys anything in its path, and deletes all entities left behind.

**NOTICE: _NOT_ an official Minecraft product. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

--------

## <img src=".github/assets/download-light.svg#gh-light-mode-only" width="22" align="center" /><img src=".github/assets/download-dark.svg#gh-dark-mode-only" width="22" align="center" /> How to Download

1. Go to the [Releases](https://github.com/ThioJoe/Scenic-Infinite-Rail-MC/releases) page.
2. For the latest release, look under Assets, then download either:
    - For **Java Edition**: `ScenicInfiniteRailMode-Java-*.zip` 
    - For **Bedrock Edition**: `ScenicInfiniteRailMode-Bedrock-*.mcaddon` 
3. For **installation steps**, see the [How To Install](#-how-to-install) section further down.

-----


# <img src=".github/assets/system_update-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/system_update-dark.svg#gh-dark-mode-only" width="28" align="center" /> Quick Setup

**Expand the sections below for exact instructions for each edition.**

The steps will basically boil down to:
  1. Choose to create a new world
  2. Add the pack during world setup
  3. Join the world

 ## **Java Edition Setup Steps:**
 <details>
    <summary>Click here to expand Java Edition instructions</summary>
     
<br>
     
 1. From the main menu, click "**Single Player**". Then "**Create New World**".
    - You can name it whatever, and the default settings are fine
 2. Under the "**More**" tab, click the "**Data Packs**" button.
 3. Drag the downloaded `ScenicInfiniteRailMode-Java-*.zip` file onto the Minecraft window (no need to extract).
     - Confirm "Yes" if it asks. Then it should appear in the "Available" list.
 4. Activate the data pack by **clicking the "Play button"** that appears while hovering over its left icon.
 5. Ensure the datapack now shows in the "Selected" list, then click "**Done**". 
     - If it warns about experimental features, click "**Proceed**".
 6. To finish creating the world, click "**Create New World**"

Note: The "Minecart Improvements" experiment is required for Java edition, but the datapack should automatically enable this for newly created worlds so you don't have to. On an existing world, if it's not enabled, it will not even appear in the list of available datapacks.
</details>

 ## **Bedrock Edition Setup Steps:** 

  <details>
    <summary>Click here to expand Bedrock Edition instructions</summary>
     
<br>

  1. Close minecraft if it's already running _(important)_.
  2. Double click the **`*.mcaddon`** file.
    - It may ask which program to open with. Select Minecraft.
  3. Minecraft should launch, and after a few seconds should say "**Successfully imported...**" at the top.
  4. While creating a new world, go to the "**Behavior packs**" section, and click "**Activate**" next to Scenic Infinite Rail Mode.
     - This should automatically also activate the related Resource Pack
  5. Finish creating the world by clicking "**Create**"
     - You can name it whatever, and the default settings are fine
     - It may give a warning about achievements, just click "**Create Anyway**"

</details>

## **Console Setup (Xbox etc):**
#### For instructions for Bedrock on console, see: [This detailed tutorial on the Wiki](https://github.com/ThioJoe/Scenic-Infinite-Rail-MC/wiki/Installing-The-Pack-On-Console)

-------------------

# <img src=".github/assets/help-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/help-dark.svg#gh-dark-mode-only" width="28" align="center" /> How to Use

### **Starting the Ride: Just join the world**
- **The ride starts automatically** as soon as you join the world.
- When re-joining a world, you will automatically continue the ride

## Hotbar Control Items

<h3><p align="center">Bedrock:</p></h3>
<p align="center"><img width="550" alt="Bedrock Hotbar control items" src="https://github.com/user-attachments/assets/b733444a-1e68-4710-a140-253e706e09f7" /></p>
<h3><p align="center">Java:</p></h3>
<p align="center"><img width="560" alt="Java Hotbar control items" src="https://github.com/user-attachments/assets/9b0e7e83-06b4-4382-8a12-781ea255e937" /></p>

<p align="center">1: Ride Settings -- 2: Visual Settings -- 3: Toggle HUD* -- 4-6: Speed controls -- 8: Tips -- 9: Debug</p>

<p align="center"><sub>*Toggle HUD is really only necessary on Bedrock Edition for consoles. With a keyboard, F1 can be used instead.</sub></p>

### **Ride Settings**:
  * **Sky mode** (_On/Off_): If enabled, the ride goes high up into the sky instead of ground level. **Default = Off**
  * **Cart Sound** (_On/Off_): Whether the cart sound is heard or silent. **Default = On**
  * **Show Cart** (_Show/Hide_): Whether you can see the cart or not. **Default = Show**
  * **Mobs Aggro** (_On/Off_): Mobs make noise and approach the player. **Default = On**

###  **Visual Settings**: 
  * **Always Rain** (_On/Off_): If enabled, it's always raining. If disabled, normal weather cycle. **Default = Off**
  * **Storms** (_On/Off_): If disabled, any thunderstorms would be replaced by normal rain. **Default = On**
  * **Time** (_Night/Day/Default_): Optionally force a time of day. If "Default", normal day/night cycle.
  * **Torches** (_Auto/On/Off_): Adds some torches near the track. If Auto, they only appear at night. **Default = Auto**
  * **Torch Density** (_Low/Medium/High/Max_): How many torches to add, if enabled. **Default = Medium**
  * **Track Light** (_Off/Low/On_): Self illumination level of the track and surrounding blocks. **Default = On**

###  **Speed Control Items:** 
  * **Speed +**
  * **Speed -** 
  * **Speed Reset**

### **Other Items:**
  * **Toggle HUD** (Bedrock Only): Hides the HUD except for the item-name popup.
     * Mostly useful for Console version. On PC, you can simply use the F1 key to toggle the HUD.
  * **Tips:** Provides recommended game and video settings.
  * **Debug:** Provides access to the debug chat toggle, sidebar views, and command help.

------

# <img src=".github/assets/balance-light.svg#gh-light-mode-only" width="28" align="center" /><img src=".github/assets/balance-dark.svg#gh-dark-mode-only" width="28" align="center" /> Java vs Bedrock Edition Differences

Because of platform differences, the Java and Bedrock versions have visual differences, but the ride logic and settings are mostly identical.

### **Differences With the Datapack Itself:**
- Bedrock version has some custom item icons
- Bedrock version has a "Toggle HUD" item (see other sections for why)
- Bedrock version uses Native menus, Java uses clickable text in books

### **General Bedrock Advantages:**
- Currently, the "vibrant visuals" option is only in Bedrock edition (though will [eventually come to Java](https://www.minecraft.net/en-us/article/another-step-towards-vibrant-visuals-for-java-edition))
- Bedrock is the only option to run on a console, like if you want to put this on your TV

### **Bedrock Drawbacks**

**❌ Problem:** On console, you can't load custom behavior packs.

**ℹ️ Workaround:** Download the world through a realm.
  - The only way to use a custom behavior pack on a console for a local world is to host a realm with it, then download it onto the console.
  - See the [Console Installation Tutorial](https://github.com/ThioJoe/Scenic-Infinite-Rail-MC/wiki/Installing-The-Pack-On-Console) article on the Wiki.

  
**❌ Problem:** Bedrock has a hardcoded "AFK" message that also dims the screen after 15 minutes, and cannot be disabled.

**ℹ️ Workaround:** Some kind of automated input to prevent going AFK.
   - On PC, use software that automatically sends inputs.
   - On Console, a use rubber band or anything to hold the left joystick. (Since you're in the cart, the left movement joystick doesn't matter)

---------


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

<details>
    <summary>Expand for Details</summary>

#### This repository is a monorepo containing shared logic and edition-specific files.

There's also a `Make-Symlinks.ps1` powershell script in the `tools` folder, which will automatically create combined directories in a `dist_links` folder.
  - For Bedrock you can symlink the `_BP` and `_RP` folders in `development_behavior_packs` and `development_resource_packs` respectively.
  - For Java, you can drag the `_Java` folder into the Data Packs window to create a new world with the combined java build.
  - You'll probably have to re-run the `.ps1` script if you make any changes that add a new file.

**Recommended:** The repository has a build script as a GitHub workflow action. You can simply fork the repo and it should make new build artifacts on every commit.

**For building locally:**
1. Ensure a JavaScript runtime (Node.js) is available.
2. Execute `node tools/build.mjs` from the repository root to assemble the packs.
3. The build script aggregates shared functions from `src/shared/functions/` and edition-specific files to generate the distribution folders.

</details>

----------

## Other Info

#### Supported Versions:
- **Java Edition:** Versions 1.21.9 through 26.2
- **Bedrock Edition:** Requires 1.21.120 or newer

## License
Free for personal use and monetized videos/livestreams. Redistribution, derivative publication, and other commercial use are prohibited.

See [LICENSE.md](LICENSE.md).
