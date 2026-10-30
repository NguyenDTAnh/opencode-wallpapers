"""Run after bun dev/build-backdrop-fixture.ts: uv run --with playwright --with pillow python dev/test-backdrop.py."""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

fixture = Path(__file__).parent / "out/backdrop/index.html"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
    try:
        page = browser.new_page(viewport={"width": 800, "height": 600})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(fixture.resolve().as_uri())
        canvas = page.locator("canvas.wallpapers-backdrop-canvas")
        canvas.wait_for()
        page.wait_for_function("document.querySelector('canvas').width === 800")

        def background(selector):
            return page.locator(selector).first.evaluate("e => getComputedStyle(e).backgroundColor")

        for selector in ["[data-slot=vertical-tabs-mount]", ".session"]:
            assert background(selector) == "rgba(0, 0, 0, 0)", selector
        for selector in ["[role=menu]", "[data-component=session-composer-dock]", "[data-session-title] > div"]:
            assert background(selector) == "rgb(28, 28, 28)", selector
        assert background("[role=dialog]") == "rgb(38, 38, 38)"
        assert background(".session-header-fade") == "rgba(0, 0, 0, 0)"
        assert page.locator(".session-header-fade").evaluate("e => getComputedStyle(e).backgroundImage") == "none"

        first = Image.open(BytesIO(page.screenshot())).convert("RGB")
        # Wait for a different rendered animation frame, not just a scheduled callback.
        initial = canvas.evaluate("c => c.toDataURL()")
        page.wait_for_function("before => document.querySelector('canvas').toDataURL() !== before", arg=initial)
        second = Image.open(BytesIO(page.screenshot())).convert("RGB")
        assert ImageChops.difference(first.crop((10, 200, 190, 450)), second.crop((10, 200, 190, 450))).getbbox(), "sidebar animation hidden"
        assert ImageChops.difference(first.crop((400, 150, 600, 350)), second.crop((400, 150, 600, 350))).getbbox(), "chat animation hidden"
        assert second.getpixel((50, 100)) == (28, 28, 28), "sidebar menu not opaque"
        assert second.getpixel((250, 100)) == (28, 28, 28), "chat menu not opaque"
        assert second.getpixel((400, 590)) == (28, 28, 28), "composer not opaque"
        assert second.getpixel((700, 420)) == (38, 38, 38), "dialog not opaque"
        page.screenshot(path=str(fixture.parent / "enabled.png"))
        # The dark scrim is a single 36% black layer now, not a gradient.
        scrim = page.locator(".wallpapers-backdrop-scrim-dark")
        assert scrim.count() == 1
        assert scrim.evaluate("e => getComputedStyle(e).backgroundColor") == "rgba(0, 0, 0, 0.5)"
        assert scrim.evaluate("e => getComputedStyle(e).backgroundImage") == "none"

        page.get_by_text("Toggle theme", exact=True).click()
        assert page.locator(".wallpapers-backdrop-scrim-light").count() == 1
        page.get_by_text("Toggle wallpaper", exact=True).click()
        assert canvas.count() == 0
        assert "linear-gradient" in page.locator(".session-header-fade").evaluate("e => getComputedStyle(e).backgroundImage")
        assert background(".session") == "rgb(28, 28, 28)"
        assert background("[data-slot=vertical-tabs-mount]") == "rgb(16, 16, 16)"
        page.get_by_text("Toggle wallpaper", exact=True).click()
        canvas.wait_for()
        page.wait_for_function("document.querySelector('canvas').width === 800")
        # Observe after the engine: inspect the buffer before the browser paints each resize.
        page.evaluate("""() => {
            window.resizeSamples = [];
            const canvas = document.querySelector('canvas');
            window.resizeProbe = new ResizeObserver(() => {
                const ctx = canvas.getContext('2d');
                window.resizeSamples.push({
                    width: canvas.width,
                    height: canvas.height,
                    alpha: ctx.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data[3]
                });
            });
            window.resizeProbe.observe(canvas);
        }""")
        for width, height in [(960, 640), (1200, 800), (1201, 801), (800, 600)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_function("size => window.resizeSamples.some(s => s.width === size[0] && s.height === size[1])", arg=[width, height])
        samples = page.evaluate("window.resizeSamples")
        assert all(sample["alpha"] == 255 for sample in samples), f"blank canvas during resize: {samples}"
        page.evaluate("window.resizeProbe.disconnect()")
        page.set_viewport_size({"width": 1000, "height": 700})
        page.wait_for_function("document.querySelector('canvas').width === 1000 && document.querySelector('canvas').height === 700")
        page.get_by_text("Toggle scene", exact=True).click()
        # Force another resize during the crossfade, above the engine's 640k pixel budget.
        fading_alpha = canvas.evaluate("""c => new Promise(resolve => {
            const observer = new ResizeObserver(() => {
                observer.disconnect();
                resolve(c.getContext('2d').getImageData(c.width - 1, c.height - 1, 1, 1).data[3]);
            });
            observer.observe(c);
            c.style.width = '1100px';
        })""")
        assert fading_alpha == 255, "crossfade left resized canvas partly transparent"
        canvas.evaluate("c => c.style.removeProperty('width')")
        page.get_by_text("Toggle home", exact=True).click()
        # Only colours change: header transparent, search field its own surface, button keeps the app's position.
        assert background("#home-header") == "rgba(0, 0, 0, 0)"
        assert background("[data-component=home-session-search] > label") == "rgb(38, 38, 38)"
        assert page.locator("[data-component=home-session-search] > label").evaluate("e => getComputedStyle(e).boxShadow") == "none"
        assert page.locator("canvas.wallpapers-backdrop-canvas").evaluate("e => getComputedStyle(e).filter") == "brightness(1.6)"
        page.get_by_text("Cycle brightness", exact=True).click()
        assert page.locator("canvas.wallpapers-backdrop-canvas").evaluate("e => getComputedStyle(e).filter") == "brightness(2)"
        page.get_by_text("Cycle brightness", exact=True).click()
        assert page.locator("canvas.wallpapers-backdrop-canvas").evaluate("e => getComputedStyle(e).filter") == "brightness(1.2)"
        assert background("#home-date") == "rgba(0, 0, 0, 0)"
        assert page.locator("#home-header").evaluate("e => getComputedStyle(e).position") == "relative"
        assert page.locator("#home-date").evaluate("e => getComputedStyle(e).position") == "relative"
        assert page.locator("#home-date").evaluate("e => getComputedStyle(e, '::before').backgroundColor") == "rgba(0, 0, 0, 0)"
        paint = page.locator("#home-date").evaluate("e => getComputedStyle(e, '::after').backgroundImage")
        assert paint == "none", paint
        page.screenshot(path=str(fixture.parent / "home.png"))
        assert background("[data-home-row]:not([data-selected])") == "rgba(0, 0, 0, 0)"
        # Sidebar session tabs paint from --tab-base, not background-color.
        assert page.locator("#sidebar-tab").evaluate("e => getComputedStyle(e).getPropertyValue('--tab-base').trim()") == "transparent"
        assert page.locator("#sidebar-tab").evaluate("e => getComputedStyle(e).backgroundImage").startswith("linear-gradient")
        overlay = page.locator("#sidebar-tab-selected").evaluate("e => getComputedStyle(e).getPropertyValue('--tab-overlay').trim()")
        assert overlay not in ("", "transparent"), f"active tab lost its overlay: {overlay!r}"
        assert background("[data-home-row][data-selected]") == "rgb(38, 38, 38)"
        page.locator("[data-slot=home-projects-viewport] [data-home-row] button").first.hover()
        assert background("[data-slot=home-projects-viewport] [data-home-row]:not([data-selected])") == "rgb(38, 38, 38)"
        page.get_by_text("Toggle wallpaper", exact=True).click()
        assert background("#home-header") == "rgb(28, 28, 28)"
        assert background("#home-date") == "rgb(28, 28, 28)"
        assert page.locator("#home-date").evaluate("e => getComputedStyle(e).marginInlineStart") == "0px"
        assert background("[data-home-row]:not([data-selected])") == "rgb(28, 28, 28)"
        assert not errors, errors
        print("PASS: animation, opaque controls, theme, off/on, resize, floating search pill, slim date bar, transparent projects")
    finally:
        browser.close()
