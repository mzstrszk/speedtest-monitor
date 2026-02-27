# Icon Conversion Guide

## Created Icon

A high-quality SVG icon has been created: `app-icon.svg`

**Features:**
- Metallic bullet with friendly face
- Dynamic speed lines showing motion
- Professional gradient shading
- Optimized for Windows app icon use
- Scalable vector format (crisp at any size)

## Converting SVG to ICO Format

Windows requires .ico files for application icons. Here are several methods:

### Method 1: Online Conversion (Easiest)

1. **CloudConvert** (Recommended)
   - Visit: https://cloudconvert.com/svg-to-ico
   - Upload `app-icon.svg`
   - Set output size to 256x256 (Windows standard)
   - Download the ICO file
   - Rename to required names:
     - `app-icon.ico` (main app icon)
     - `installer-icon.ico` (installer)
     - `uninstaller-icon.ico` (uninstaller)

2. **Convertio**
   - Visit: https://convertio.co/svg-ico/
   - Upload and convert
   - Download ICO file

### Method 2: Using ImageMagick (Command Line)

If you have ImageMagick installed:

```bash
# Install ImageMagick (if not installed)
brew install imagemagick

# Convert SVG to ICO
convert app-icon.svg -define icon:auto-resize=256,128,64,48,32,16 app-icon.ico

# Copy for installer and uninstaller
cp app-icon.ico installer-icon.ico
cp app-icon.ico uninstaller-icon.ico
```

### Method 3: Using Inkscape (Free Software)

1. Install Inkscape: https://inkscape.org/
2. Open `app-icon.svg` in Inkscape
3. File → Export PNG Image
4. Set width/height to 256px
5. Export as PNG
6. Use online tool to convert PNG → ICO

### Method 4: GIMP (Free Software)

1. Install GIMP: https://www.gimp.org/
2. Open `app-icon.svg` in GIMP
3. Image → Scale Image → 256x256px
4. File → Export As
5. Choose .ico format
6. Select "Compressed (RLE)" in export options

## Required ICO Files

Create these three files in `assets/icons/`:

1. **app-icon.ico** - Main application icon
   - Used for: App window, taskbar, Alt+Tab
   - Size: 256x256px (multi-resolution)

2. **installer-icon.ico** - Installer program icon
   - Used for: Setup.exe icon
   - Size: 256x256px

3. **uninstaller-icon.ico** - Uninstaller program icon
   - Used for: Uninstall.exe icon in Control Panel
   - Size: 256x256px

## Quick Start (Same Icon for All)

For simplicity, you can use the same icon for all three:

```bash
# After converting app-icon.svg to app-icon.ico
cp app-icon.ico installer-icon.ico
cp app-icon.ico uninstaller-icon.ico
```

## Verify Icons Before Building

Ensure all icons exist:

```bash
ls -la assets/icons/*.ico
```

You should see:
- app-icon.ico
- installer-icon.ico
- uninstaller-icon.ico

## Testing the Icon

After conversion, test the icon:

1. Right-click the ICO file
2. Select "Open with" → Windows Photo Viewer / Preview
3. Verify it displays correctly at different sizes

## ICO File Specifications

Windows ICO files should contain multiple resolutions:
- 256x256 (Windows 7+, high DPI)
- 128x128
- 64x64
- 48x48 (Windows standard)
- 32x32 (small icons)
- 16x16 (tiny icons, system tray)

Modern conversion tools handle this automatically.
