# Icons Directory

This directory contains the application icons used by SpeedTest Monitor.

## Required Icons

### Application Icons
- `app-icon.png` - Main application icon (256x256)
- `app-icon.ico` - Windows application icon (multiple sizes: 16, 32, 48, 256)

### Tray Icons
- `tray-idle.png` - System tray icon when idle (16x16, 32x32)
- `tray-active.png` - System tray icon when testing (16x16, 32x32) 
- `tray-error.png` - System tray icon when error occurred (16x16, 32x32)

### Notification Icons  
- `notification-info.png` - Information notification icon (32x32)
- `notification-success.png` - Success notification icon (32x32)
- `notification-warning.png` - Warning notification icon (32x32)
- `notification-error.png` - Error notification icon (32x32)

### Installer Icons (Windows)
- `installer-icon.ico` - NSIS installer icon
- `uninstaller-icon.ico` - NSIS uninstaller icon

## Icon Creation Guidelines

1. Use PNG format for cross-platform compatibility
2. Use ICO format for Windows-specific icons
3. Maintain consistent visual style across all icons
4. Use appropriate colors:
   - Blue (#007bff) - Primary/active states
   - Green (#28a745) - Success states  
   - Yellow/Orange (#ffc107) - Warning states
   - Red (#dc3545) - Error states
   - Gray (#6c757d) - Idle/disabled states

## Placeholder Icons

Until proper icons are created, the application will use:
- Empty/transparent icons for missing files
- Fallback to system default icons where possible
- Graceful degradation for unsupported platforms

## Tool Recommendations

For creating icons:
- Adobe Illustrator/Photoshop
- GIMP (free alternative)
- Inkscape (vector graphics)
- Online icon generators
- Icon font libraries (Font Awesome, etc.)