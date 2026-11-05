# Don't Touch the Wall

A browser game built for CIT 384 (Web Development with Hosting) at CSUN. You trace a path with your mouse from the start to the goal. Touch the wall and you restart the level. There are 8 levels, and each one gets harder.

**Live demo:** `http://YOUR_SERVER_IP/game/` (replace with your link)

## How to Play

1. Click the green dot to start a level.
2. Move your mouse along the blue path to the gold goal.
3. If you touch the black area, leave the board, or get hit by a red dot, you go back to the start of the level.
4. Beat all 8 levels with the fastest time and fewest deaths.

## Features

* **8 levels** where the path gets thinner and has more turns each time
* **Moving obstacles** (red dots) starting on level 4 that slide back and forth along the path
* **Lights Out mode** on the last two levels: you see the map before starting, then everything goes dark except a small circle around your cursor
* **Fast movement detection** so players can't skip over a wall by flicking the mouse
* Death counter, run timer, and best time saved in the browser
* Sound effects made with the Web Audio API (no audio files)
* Works with a mouse or a touch screen

## How It Works

* Each level is stored as a list of points that make up the path, plus a path width.
* To check if the player is safe, the game measures the distance from the cursor to the closest part of the path. If that distance is bigger than half the path width, the player touched the wall.
* Between every mouse movement, the game also checks small steps along the line from the old position to the new one. This stops players from moving fast enough to jump past a wall between frames.
* Red dots move back and forth along the same path using the total path length, so they always stay on the track.
* Everything is drawn on an HTML5 canvas using `requestAnimationFrame` for smooth animation.

## Tech Used

| Part | Tool |
|------|------|
| Structure | HTML5 |
| Styling | CSS3 |
| Game logic and drawing | JavaScript (Canvas API, Web Audio API) |
| Web server | Apache on Linux |
| Deployment | SSH and Git |

## Project Structure

```
dont-touch-the-wall/
├── index.html   Page layout, score display, and rules
├── style.css    Colors, layout, and styling
├── game.js      Levels, collision detection, drawing, and game loop
└── README.md
```

## Deployment

The game is hosted on a Linux server running Apache. It was deployed over SSH by cloning this repo into the web folder:

```
ssh -i yourkey.pem ubuntu@YOUR_SERVER_IP
sudo apt update && sudo apt install git apache2 -y
cd /var/www/html
sudo git clone https://github.com/herreragerman313/dont-touch-the-wall.git game
```

To update the live site after pushing changes:

```
cd /var/www/html/game && sudo git pull
```

## Security Notes

* The game runs fully in the browser. It sends no data to any server and collects no personal info.
* There is no user input form, login, or database, so there is nothing to inject into.
* No outside scripts or libraries are loaded. All code comes from this repo.
* The only thing stored is the best time, kept in the player's own browser with `localStorage`. The code handles cases where storage is blocked so the game still works.

## What I Learned

* Hosting a static site on Apache and deploying it over SSH
* Using Git to move code from my laptop to a live server
* Collision detection using distance from a point to a line segment
* Building a game loop and handling game states (ready, playing, dead, cleared, finished)
* Keeping HTML, CSS, and JavaScript in separate files

## Author

**German Herrera**, Computer Information Technology, CSUN
GitHub: [herreragerman313](https://github.com/herreragerman313)
