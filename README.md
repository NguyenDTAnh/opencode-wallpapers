# OpenCode Wallpapers

Animated wallpapers for the OpenCode terminal UI: slow, quiet scenes behind everything, kept readable behind text.

![Beach, tundra, jungle, desert and space wallpapers in motion](screenshots/hero.gif)

> This project is not affiliated with, endorsed by, or sponsored by OpenCode or its maintainers.

## Install

Requires OpenCode 2. Clone into OpenCode's plugin directory and restart OpenCode:

```sh
git clone https://github.com/vaprdev/opencode-wallpapers.git ~/.config/opencode/plugins/wallpapers
```

Update with `git pull`.

## Use

Type `/wallpaper` to open the menu. ↑/↓ picks a setting, Enter or ←/→ changes it, Escape closes it.

![The wallpaper menu](screenshots/menu.png)

- **Activity:** calm, lively or teeming: how much moves behind your work.
- **Time:** day, sunset or night, or auto to follow your clock.
- **Season and weather:** follow the calendar, or the real weather where you are (`/wallpaper location Berlin`).
- **Brightness, shuffle, per project and power:** subtle to vivid, a new wallpaper every hour, one per project, and
  slowing down when idle.

Scenes react to your agent: they speed up while it works, a visitor shows up when it finishes, and clouds roll in after
an error. With mouse support, clicking empty background nudges the scene, and each wallpaper hides a rare surprise.

## Wallpapers

`ocean` · `desert` · `jungle` · `space` · `farm` · `tundra` · `beach` · `city` · `zen` · `prehistoric` · `rider` ·
`megacity` · `dome` · `haunted-house` · `flowerbox`

| Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- |
| ![Farm in spring](screenshots/farm-spring.png) | ![Farm in summer](screenshots/farm-summer.png) | ![Farm in autumn](screenshots/farm-autumn.png) | ![Farm in winter](screenshots/farm-winter.png) |

![Farm in the rain](screenshots/farm-rain.png)

## Terminals

Any truecolor terminal works. Ghostty and kitty get finer octant characters; others get quadrant blocks.

| Variable | Effect |
| --- | --- |
| `WALLPAPER_PIXELS=1` | In Ghostty or kitty, draw the scene as a real image |
| `WALLPAPER_SUPERSAMPLE=2` | Smoother edges, at about 2.5x the CPU |
| `WALLPAPER_OCTANTS=0` or `1` | Force quadrant or octant characters |
| `WALLPAPER_SMOOTH=0` | Octants without wedges and eighth blocks |
| `WALLPAPER_LOCATION` | A place or `latitude,longitude` for local weather |

## Make a wallpaper

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Gallery

At teeming, played back at 3x speed:

| | |
| --- | --- |
| ![Ocean in motion](screenshots/ocean.gif) | ![Desert in motion](screenshots/desert.gif) |
| ![Jungle in motion](screenshots/jungle.gif) | ![Space in motion](screenshots/space.gif) |
| ![Farm in motion](screenshots/farm.gif) | ![Tundra in motion](screenshots/tundra.gif) |
| ![Beach in motion](screenshots/beach.gif) | ![City in motion](screenshots/city.gif) |
| ![Zen garden in motion](screenshots/zen.gif) | ![Prehistoric in motion](screenshots/prehistoric.gif) |
| ![Rider in motion](screenshots/rider.gif) | ![Megacity in motion](screenshots/megacity.gif) |
| ![Dome in motion](screenshots/dome.gif) | ![Haunted house in motion](screenshots/haunted-house.gif) |
| ![Flower Box in motion](screenshots/flowerbox.gif) | |

| | Day | Sunset | Night |
| --- | --- | --- | --- |
| Ocean | ![Ocean by day](screenshots/ocean.png) | ![Ocean at sunset](screenshots/ocean-sunset.png) | ![Ocean at night](screenshots/ocean-night.png) |
| Desert | ![Desert by day](screenshots/desert.png) | ![Desert at sunset](screenshots/desert-sunset.png) | ![Desert at night](screenshots/desert-night.png) |
| Jungle | ![Jungle by day](screenshots/jungle.png) | ![Jungle at sunset](screenshots/jungle-sunset.png) | ![Jungle at night](screenshots/jungle-night.png) |
| Space | ![Space by day](screenshots/space.png) | ![Space at sunset](screenshots/space-sunset.png) | ![Space at night](screenshots/space-night.png) |
| Farm | ![Farm by day](screenshots/farm.png) | ![Farm at sunset](screenshots/farm-sunset.png) | ![Farm at night](screenshots/farm-night.png) |
| Tundra | ![Tundra by day](screenshots/tundra.png) | ![Tundra at sunset](screenshots/tundra-sunset.png) | ![Tundra at night](screenshots/tundra-night.png) |
| Beach | ![Beach by day](screenshots/beach.png) | ![Beach at sunset](screenshots/beach-sunset.png) | ![Beach at night](screenshots/beach-night.png) |
| City | ![City by day](screenshots/city.png) | ![City at sunset](screenshots/city-sunset.png) | ![City at night](screenshots/city-night.png) |
| Zen garden | ![Zen garden by day](screenshots/zen.png) | ![Zen garden at sunset](screenshots/zen-sunset.png) | ![Zen garden at night](screenshots/zen-night.png) |
| Prehistoric | ![Prehistoric by day](screenshots/prehistoric.png) | ![Prehistoric at sunset](screenshots/prehistoric-sunset.png) | ![Prehistoric at night](screenshots/prehistoric-night.png) |
| Rider | ![Rider by day](screenshots/rider.png) | ![Rider at sunset](screenshots/rider-sunset.png) | ![Rider at night](screenshots/rider-night.png) |
| Megacity | ![Megacity by day](screenshots/megacity.png) | ![Megacity at sunset](screenshots/megacity-sunset.png) | ![Megacity at night](screenshots/megacity-night.png) |
| Dome | ![Dome by day](screenshots/dome.png) | ![Dome at sunset](screenshots/dome-sunset.png) | ![Dome at night](screenshots/dome-night.png) |
| Haunted house | ![Haunted house by day](screenshots/haunted-house.png) | ![Haunted house at sunset](screenshots/haunted-house-sunset.png) | ![Haunted house at night](screenshots/haunted-house-night.png) |
| Flower Box | ![Flower Box by day](screenshots/flowerbox.png) | ![Flower Box at sunset](screenshots/flowerbox-sunset.png) | ![Flower Box at night](screenshots/flowerbox-night.png) |

## License

[MIT](LICENSE)
