# .and — Guest Welcome (prototype)

A quiet welcome for the reception area. The iPad greets a waiting visitor by name and lets them choose a drink and a snack, with calories and allergen information. The assistant's phone receives the order.

| Screen | URL | Device | PIN |
|---|---|---|---|
| Guest | `/guest` | the waiting-area iPad (landscape) | none |
| Reception | `/reception` | iPad, laptop or any phone | **1234** |
| Orders | `/orders` | the assistant's phone | none (optional, see below) |
| Admin | `/admin` | any device | **4321** |

## Run it

Requires Node 18+ (tested on 22).

```bash
cd guest-welcome
npm install
npm start
```

The terminal prints your **local-network URLs**, for example:

```
On your Wi-Fi    http://192.168.1.42:3000
guest      http://192.168.1.42:3000/guest
reception  http://192.168.1.42:3000/reception
orders     http://192.168.1.42:3000/orders
admin      http://192.168.1.42:3000/admin
```

Keep the computer running the server on the same Wi-Fi as the iPad and phone. Type those addresses into Safari on each device. (`http://localhost:3000` also lists the four screens.)

Options (environment variables): `PORT`, `RECEPTION_PIN`, `ADMIN_PIN`, `ORDERS_PIN` (set it to require a PIN on the orders screen), `DATA_DIR`. PINs can also be changed in **Admin → Settings**.

## Set up the iPad

1. Open `http://<your-ip>:3000/guest` in Safari.
2. Tap **Share → Add to Home Screen**. It then opens full-screen, with no browser bars.
3. **Settings → Display & Brightness → Auto-Lock → Never**, and keep the iPad plugged in.
4. **Kiosk mode:** Settings → Accessibility → Guided Access → On, then set a passcode. Open the home-screen app, triple-click the top or Home button, and tap **Start**. Guests can't leave the app. The app has no external links, so nothing can pull them out.

The guest page never needs a keyboard. Names are typed on `/reception`, which can run on a different device.

## Set up the assistant's phone

Open `/orders` and tap **Turn on sound** once (iOS requires a tap before it will play audio). Add it to the Home Screen if you like. New orders arrive with a chime, a vibration where supported, an orange flash and a pulsing **NEW** card. **Done** clears the order. If the Wi-Fi drops, the page shows "Reconnecting…" and catches up on its own, and any missed orders appear on reconnect.

## Demo script (about 3 minutes)

1. Show the iPad idle: slow portfolio slideshow and the studio news line.
2. On your phone, open `/reception`. Enter the PIN, type a guest name and who they're meeting, then tap **Hand over to guest**. The iPad greets them at once.
3. On the iPad: **Choose a refreshment**, then tap *Cappuccino*. Pick oat milk and 25% sugar. Calories and allergens update live.
4. Switch on **I have dietary needs** and tick *Tree nuts* and *Milk*. Unsuitable items are dimmed with the reason (or hidden). Oat and soy milk stay available; almond becomes unavailable.
5. Pick a snack, review, then confirm. The wait time appears and the screen returns to the showcase after 20 seconds.
6. On the assistant's phone, the order arrives with the chime. The allergen banner shows what the guest avoids, and a stronger banner appears if they chose something containing it. Tap **Done**.
7. In `/admin`, mark an item **out of stock** or change the idle message. The iPad updates immediately.

## What's in the box

- **Idle showcase:** a Ken Burns slideshow of portfolio images with the news line. Touch anywhere to wake. The guest screen returns to idle after 90s of inactivity, and selections and dietary choices are cleared.
- **Drinks:** milk, sugar, ice and temperature options per drink. Milk choice changes the allergens (oat gives gluten, almond gives tree nuts, soy gives soya, whole gives milk) and the calories.
- **Allergen filter:** the 14 EU allergens, with "Highlight unsuitable" or "Hide unsuitable".
- **Admin:** menu (add, edit, remove, out-of-stock), portfolio (URL or upload, reorder), news, idle and welcome messages, timings, wait estimate, PINs.

## Privacy

- No analytics, no third-party requests, and fonts are self-hosted.
- A guest's name is removed from the server as soon as their order is placed, or after `retentionHours` (default 4) if they never order.
- Orders are deleted when the assistant taps **Done**, and any left open are purged after the same retention window.
- Data lives in `data/db.json`, which is git-ignored. Uploaded images go in `data/uploads/`.
- The server runs over plain HTTP on your LAN. Don't expose it to the internet.

## Before real use

- **All calories, allergens and dietary tags are TEST DATA** (see `seed.js`). Have the caterer's verified information entered in Admin → Menu. The guest screen says allergen details are a guide, and the assistant's screen asks staff to check labels.
- **Portfolio photos** are hot-linked Unsplash placeholders (`seed.js`). If the iPad can't reach them, a neutral tile shows instead. Replace them with the studio's own photography via Admin → Portfolio, using upload, which also works with no internet.
- **Logo:** `public/assets/logo.png` is your supplied logo. Replace the file to update it everywhere. It is shown with a multiply blend so a white background disappears on the off-white pages.
- **Starting over:** stop the server and delete `data/db.json` to restore the sample content.

## Tests

`npm test` runs an end-to-end API check (auth, ordering, allergen maths, live feed, admin CRUD) against a throw-away data folder.

## Files

```
server.js            Express server, JSON storage, SSE, PIN auth, privacy purge
seed.js              Starting content (TEST DATA)
public/js/shared.js  Allergen vocabulary + customisation rules (used by server and browsers)
public/guest|reception|orders|admin/   The four screens (vanilla JS, no build step)
```
