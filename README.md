# Lentz TunerPro 🎯
### Master Rimfire (.22 LR) Barrel Harmonics & Tuner Optimization Platform
*Dedicated to Jeremiah Lentz — Lentz Precision Rifles & Lentz Competition Barrels (Bristol / Blountville, TN)*

---

## ⚡ Overview

In precision rimfire benchrest (.22 LR) competition (ARA, PSL, IR50/50), shooters cannot handload ammunition to alter muzzle velocity. Every match lot of Lapua Center-X, Midas+, or Eley Tenex has an Extreme Spread (ES) of 10–25 fps.

To eliminate vertical stringing caused by velocity variance, master gunsmith **Jeremiah Lentz** threads adjustable muzzle tuners (such as **Harrell Precision**, Ezell, or Gorham tuners) onto custom match barrels.

**Lentz TunerPro** is a modern, mobile-forward, macOS/iOS dark theme progressive web application designed to run at the bench on mobile or in the workshop on desktop:
- **Harrell Rotary Dial Simulation**: Draggable machined circular dial with 50 clicks/rev, micrometer travel readout, and audible metallic click synthesis.
- **Interactive Target CV Scanner**: Coin/ring calibration (Quarter, Dime, ARA 100 ring, 1" ruler), .224" bullet-wipe ring detection, touch-driven 3x Apple-style loupe magnifier, and instant calculation of **Vertical Dispersion**, Group ES, Mean Radius, and 50-Yard MOA.
- **Harmonic Sweet Spot & Forgiving Window Engine**: Polynomial regression curve fitting on vertical dispersion to pinpoint the wide trough where muzzle exit velocity variances produce zero vertical fliers.
- **Atmospheric & Density Altitude (DA) Engine**: Open-Meteo live weather integration with dynamic thermal shift compensation (e.g. +1 click per ~5.5°F warming between morning and afternoon relays).
- **Lentz Custom Barrel & Ammo Logbook**: Pre-seeded with genuine Jeremiah Lentz match profiles (Stiller 2500X Shilen 5R, Turbo V-1 Muller 8G, RimX Bartlein Gain-Twist) and full JSON backup/restore.
- **Practical AI Ballistic Advisor**: No gimmicks—a real diagnostic consultant evaluating node width, positive launch angle compensation, and double-hole / paper tear disambiguation.

---

## 🚀 Running the App

```bash
# Start on default port
npm run dev

# Or run on port 3030
npx next start -p 3030
```

Open [http://localhost:3030](http://localhost:3030) in your browser.

---

## 📐 The Physics: Positive Compensation & The Calfee / PRX Node

When a rifle fires, the barrel vibrates in complex harmonic waves. 
- In an **untuned** barrel, a slightly slower bullet takes longer to exit and drops more at 50 yards, creating a low shot.
- In a **properly tuned Lentz barrel**, the tuner weight is dialed so the bullet exits while the muzzle is swinging **upward**. A slower bullet exits slightly later when the muzzle angle is higher, imparting a compensatory upward launch angle that lands on the exact same horizontal waterline as a faster bullet.
- The **Forgiving Window** is the flat plateau in the vertical dispersion vs. click curve. A wider window means your tune will hold across changing temperatures, lot variations, and wind conditions.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS with Apple Pro dark OLED glassmorphism
- **Icons**: Lucide React
- **Audio**: Web Audio API mechanical click synthesizer
- **Target CV**: HTML5 Canvas with sub-pixel 3x zoom loupe & edge contrast detection
- **Weather**: Open-Meteo API & ISA Density Altitude ballistics formulas
- **Storage**: Offline-first LocalStorage with full JSON export & import
