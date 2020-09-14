
var game = require('./app.js');

module.exports = class Electron {

  constructor(server, index, arenaSize){

    //random positive or negative

    this.arenaSize = game.getArenaSize(server);
    this.randomizeSpawn();
    this.randomizeDelta();
    this.color = Math.floor(Math.random() * 7);
    this.dir = 0;
    this.server = server;
    this.index = index;
    this.origin = -1;
    this.sendId = -1;
    this.orbitSector = -1;
    this.boundLoc = 0;
    this.intervals = {};

    this.maxFireSpeed = 680;
    this.minFreeSpeed = 22;

  }

  startFreeMove(){

    this.lastUpdate = Date.now();

    this.deltaFree = setInterval(() => this.mainMove(), 1000/66);

  }

  randomizeSpawn(){

    var spawnRange = this.arenaSize - 1000;
    this.xc = (Math.random() * spawnRange) + 100;
    this.yc = (Math.random() * spawnRange) + 100;

    this.xc = Math.trunc(this.xc);
    this.yc = Math.trunc(this.yc);

  }

  randomizeDelta(){

    var dxTemp = Math.random() * (Math.random() < 0.5 ? -1 : 1);
    var dyTemp = Math.random() * (Math.random() < 0.5 ? -1 : 1);
    this.dx = ((dxTemp * 100) / 100) * 66;
    this.dy = ((dyTemp * 100) / 100) * 66;

  }

  mainMove(){

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    //update after we have the delta

    this.freeMove(xDelta, yDelta);

  }

  freeMove(xDelta, yDelta){

    //movement when not in pull

    this.xc += xDelta;
    this.yc += yDelta;

    //keep in bounds

    var inBound = true;

    if(this.xc < 0 || this.xc > this.arenaSize){

      this.dx = -this.dx;
      this.boundLoc++;
      inBound = false;
      this.explodeOnWallHit();

    }

    if(this.yc < 0 || this.yc > this.arenaSize){

      this.dy = -this.dy;
      this.boundLoc++;
      inBound = false;
      this.explodeOnWallHit();

    }

    //if object is still in bound, it is NOT stuck behind a wall

    if(inBound){

      this.boundLoc = 0;

    }

    //if it has been out of bound more more than 22 frames, assume its stuck
    //refresh it

    if(this.boundLoc > 22){

      this.refresh();

    }

  }

  explodeOnWallHit(){

    //if electron hits wall too fast, blow it up

    if(Math.abs(this.dx) > 120 || Math.abs(this.dy) > 120){

      this.refresh();

      game.electronAlert(this.server, 'eXpl', this.index, this.index);

    }

  }

  free(){

    //free from orbit

    if(this.deltaOrbit){

      clearInterval(this.deltaOrbit);

    }

    //check if its out of bounds

    if(this.xc < 0 || this.xc > this.arenaSize || this.yc < 0 || this.yc > this.arenaSize){

      this.refresh();
      game.electronAlert(this.server, 'eXpl', this.index, this.index);

    } else {

      this.setFreeSpeed();

      this.startFreeMove();

      //if electron is not charged, then set it to an empty origin

      if(this.origin !== -2){

        this.origin = -1;

      }

    }

  }

  refresh(){

    this.randomizeDelta();
    this.color = Math.floor(Math.random() * 4);
    this.boundLoc = 0;
    this.orbitSector = -1;

    //reset the orbital properties as well

    this.origin = -1;
    this.sendId = -1;

    this.cw = undefined;
    this.dist = undefined;
    this.dir = undefined;

    //clear all intervals

    this.clear();

    this.resetLocation();

  }

  resetLocation(){

    var distant = true, limit = 0;

    do {

      distant = this.findNewSpawnPoint();

      //give 50 tries

      limit++;

    } while(!distant && limit < 50);

    //once we have new location, restart free interval

    if(distant){

      this.startFreeMove();

    } else {

      //could not find a position in 50 tries
      //put offscreen

      this.xc = -5000;
      this.yc = -5000;

      //wait a second and try again

      setTimeout(() => {

        this.resetLocation();

      }, 1000);

    }

  }

  findNewSpawnPoint(){

    //respawn at random point on map

    var spawnRange = this.arenaSize - 100, oldX = this.xc, oldY = this.yc;

    this.xc = Math.round(Math.random() * spawnRange) + 100;
    this.yc = Math.round(Math.random() * spawnRange) + 100;

    //make sure theres some distance between old and new points

    var totalDistance = this.getDistance(oldX, oldY, this.xc, this.yc);

    if(totalDistance < 1000){

      return false;

    }

    //make sure it wont spawn on any other players

    var posX = this.xc + 600, posY = this.yc + 600;
    var negX = this.xc - 600, negY = this.yc - 600;

    var i, players = game.getServer(this.server);

    for(i in players){

      //if in range of a player, return false;

      if((negX < players[i].xc && players[i].xc < posX) &&
      (negY < players[i].yc && players[i].yc < posY)){

        return false;

      }

    }

    return true;

  }

  orbit(id){

    var plyr = game.getPlayer(this.server, id);

    if(plyr){

      clearInterval(this.deltaFree);

      if(this.energyLossInterval){

        clearInterval(this.energyLossInterval);

        this.energyLossInterval = null;

      }

      //set directional speed (choose biggest delta, limiting to 66)

      this.cw = this.directional(this.dx, this.dy);
      this.origin = id;
      this.sendId = id;

      this.color = plyr.color;

      //get initial angle in degrees

      var px = plyr.xc, py = plyr.yc,
          ex = this.xc, ey = this.yc,
          initAngle = Math.atan2((py - ey), (px - ex));

      //distance between two player and electron

      var a = px - ex,
          b = py - ey;
      this.dist = Math.sqrt(a*a + b*b);

      this.getDirIncrement();

      this.dir = (initAngle * 180 / Math.PI) - 90;

      if(this.dir < 0){

        //if negative angle, just add 360 to turn it positive

        this.dir += 360;

      }

      //then limit speed on dx and dy

      if(this.dx > 66){ this.dx = 66; }
      if(this.dy > 66){ this.dy = 66; }

      //tell all others nearby

      this.alertServerOfOrbit();

      //start orbit movement

      this.lastUpdate = Date.now();

      this.deltaOrbit = setInterval(() => this.startDeltaOrbit(), 1000/66);

    } else {

      this.refresh();

    }

  }

  alertServerOfOrbit(){

    var orbitData = [

      this.index,
      this.dirIncrement,
      this.cw,
      this.dist,
      this.dir,
      this.origin,
      this.color,
      this.dx,
      this.dy,
      this.xc,
      this.yc

    ];

    game.electronAlert(this.server, 'elOrb', orbitData, this.index);

  }

  startDeltaOrbit(){

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    var dirDelta = this.dirIncrement * (this.delta/1000);

    //update after we have the delta

    this.orbitMove(dirDelta);

  }

  orbitMove(dirDelta){

    var plyr = game.getPlayer(this.server, this.origin);

    if(plyr){

      var originX = plyr.xc;
      var originY = plyr.yc;

      var degrees = this.dir - 90;
      var radians = degrees / 180 * Math.PI;

      this.dx = Math.cos(radians);
      this.dy = Math.sin(radians);

      this.xc = originX + this.dx * this.dist;
      this.yc = originY + this.dy * this.dist;

      if(this.cw === 1){

        this.dir += dirDelta;

        if(this.dir > 360){

          this.dir = 0;

        }

      } else {

        this.dir -= dirDelta;

        if(this.dir < 0){

          this.dir = 360;

        }

      }

    }

  }

  clear(){

    clearInterval(this.deltaFree);
    clearInterval(this.deltaOrbit);

    if(this.energyLossInterval){

      clearInterval(this.energyLossInterval);

    }

  }

  orbitTangent(keepEnergy){

    //releasing from orbit with little to no input energy

    var degrees;

    if(this.cw === 1){

      degrees = this.dir;

    } else {

      degrees = this.dir + 180;

      if(degrees > 360){

        degrees -= 360;

      }

    }

    var radians = degrees / 180 * Math.PI;

    this.dx = Math.cos(radians);
    this.dy = Math.sin(radians);

    //dx and dy are slow as of now
    //speed them up

    switch(this.orbitSector){

      case 0:

        this.dx *= (66 * (this.dist / 100));
        this.dy *= (66 * (this.dist / 100));

      break;

      case 1:

        this.dx *= (66 * (this.dist / 192));
        this.dy *= (66 * (this.dist / 192));

      break;

      case 2:

        this.dx *= (66 * (this.dist / 360));
        this.dy *= (66 * (this.dist / 360));

      break;

    }

  }

  fire(dx, dy){

    //player fires an electron

    if(Math.abs(dx) > .5 || Math.abs(dy) > .5){

      this.adjustFireSpeed(dx, dy);

    } else {

      //if theres not enough input energy from player

      this.orbitTangent(true);

    }

    //set origin to hostile value -2

    this.origin = -2;

    this.free();

    setTimeout(() => {

      this.origin = -1;
      this.sendId = -1;

    }, 2000);

    //tell the server

    var sendArr = [

      this.index,
      this.dx,
      this.dy,
      this.xc,
      this.yc

    ];

    game.electronAlert(this.server, 'fired', sendArr, this.index);

  }

  getDirIncrement(){

    this.dirIncrement = Math.abs(this.dx) > Math.abs(this.dy) ? Math.abs(this.dx) : Math.abs(this.dy);

    //limit increment so electron doesnt orbit too fast or slow
    //limits are dependent on distance, since, for example, an electron
    //thats only 100px away with a directional increment of 50 will move much slower
    //than an electron thats 1000px away with an increment of 50

    var randomizedIncrement, oldSector = this.orbitSector;

    if(this.dist < 400){

      if(this.dirIncrement > 66){

        this.dirIncrement = 66;

      } else if(this.dirIncrement < 33){

        this.dirIncrement = 33;

      }

      this.orbitSector = 0;

      randomizedIncrement = Math.trunc(Math.random() * 16);

    } else if(this.dist >= 400 && this.dist < 700){

      if(this.dirIncrement > 24){

        this.dirIncrement = 24;

      } else if(this.dirIncrement < 16){

        this.dirIncrement = 16;

      }

      this.orbitSector = 1;

      randomizedIncrement = Math.trunc(Math.random() * 8);

    } else if(this.dist >= 700){

      if(this.dirIncrement > 18){

        this.dirIncrement = 18;

      } else if(this.dirIncrement < 8){

        this.dirIncrement = 8;

      }

      this.orbitSector = 2;

      randomizedIncrement = Math.trunc(Math.random() * 4);

    }

    this.dirIncrement += randomizedIncrement;

  }

  adjustFireSpeed(dx, dy){

    //limit speed so we dont fire too fast

    this.dx = dx * 120;
    this.dy = dy * 120;

    if(this.dx > this.maxFireSpeed){ this.dx = this.maxFireSpeed; }
    if(this.dy > this.maxFireSpeed){ this.dy = this.maxFireSpeed; }
    if(this.dx < -this.maxFireSpeed){ this.dx = -this.maxFireSpeed; }
    if(this.dy < -this.maxFireSpeed){ this.dy = -this.maxFireSpeed; }

  }

  setFreeSpeed(){

    var key = Math.random();

    this.energyLossInterval = setInterval(() => {

      //we have a key to signify this interval

      //if you shoot an electron, it will start to slow down,
      //but, if you capture an electron in its slow down interval already, and shoot it again
      //it will not slow down

      //the key will differentiate between different slow down intervals

      this.energyLossKey = key;

      this.dx *= .75;
      this.dy *= .75;

      if(this.dx < this.minFreeSpeed && this.dx > 0){this.dx = this.minFreeSpeed}
      if(this.dx > -this.minFreeSpeed && this.dx < 0){this.dx = -this.minFreeSpeed}
      if(this.dy < this.minFreeSpeed && this.dy > 0){this.dy = this.minFreeSpeed}
      if(this.dy > -this.minFreeSpeed && this.dy < 0){this.dy = -this.minFreeSpeed}

      var sendArr = [

        this.index,
        this.dx,
        this.dy

      ];

      //this method is on a timeout so we need to ensure server still exists

      if(game.serverExists(this.server)){

        game.electronAlert(this.server, 'eSlow', sendArr, this.index);

      }

    }, 500);

    setTimeout(() => {

      if(this.energyLossInterval && this.energyLossKey === key){

        clearInterval(this.energyLossInterval);

      }

    }, 4500);

  }

  directional(dx, dy){

    //determine if its best to go clockwise or counter

    var cw = 0;

    if((dx >= 0 && dy < 0) ||
       (dx < 0 && dy >= 0)){

        cw = 1;

    }

    return cw;

  }

  getDistance(x1, y1, x2, y2){

    var dx = x1 - x2,
        dy = y1 - y2;

    return Math.sqrt((dx * dx) + (dy * dy));

  }

  roundDeltas(){

    //trunc for optimization

    this.dx = Math.trunc(this.dx);
    this.dy = Math.trunc(this.dy);

  }

}
