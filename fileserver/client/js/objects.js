
class Player {

	constructor(id){

			this.id = id;
			this.mainPlayer = true;

			//x and y coordinates

			this.xc = 0;
			this.yc = 0;

			//directional x and y values

			this.dx = 0;
			this.dy = 0;

			//x and y viewpoint (-x and -y with account for screen size)

			this.xView = 0;
			this.yView = 0;

			this.camera = false;
			this.maxSpeed = 360;
			this.alive = false;
			this.active = false;
			this.color = 0;
			this.image;
			this.name = "";
			this.started = false;
			this.orbitCount = 0;
			this.orbitMax = 5;

	}

	deltaPosition(){

			this.lastUpdate = Date.now();

	    var self = this;

	    this.calcInterval = setInterval(function(){

	      var now = Date.now();

	      self.delta = now - self.lastUpdate;

	      self.lastUpdate = now;

	      var delta = self.maxSpeed * (self.delta/1000);

	      //update after we have the delta

	      self.calcPosition(delta);

	    }, 1000/Game.fps);

		}

		calcPosition(delta){

			//divide canvas-style grid by fourths

			var radians = Math.atan2(Game.mouseY, Game.mouseX), speed;

			//divide canvas-style grid by fourths

			var mouseDistX = Math.abs(Game.mouseX / (Game.xMax/4));
			var mouseDistY = Math.abs(Game.mouseY / (Game.yMax/4));

			if(mouseDistX > 1){ mouseDistX = 1; }
			if(mouseDistY > 1){ mouseDistY = 1; }

			//find best speed

			var xSpd = mouseDistX * delta;
			var ySpd = mouseDistY * delta;
			xSpd > ySpd ? speed = xSpd : speed = ySpd;

			this.dx = Math.cos(radians) * speed;
			this.dy = Math.sin(radians) * speed;

			//if they're going to go offscreen

			//but predict with their actual location (50ms in future)
			//not tweening location

			var numOfFrames = 25/(1000/Game.fps),
					futureX = this.xc + (this.dx * numOfFrames),
					futureY = this.yc + (this.dy * numOfFrames);

			if(((futureX + this.dx + 25) > Game.arenaSize || (futureX + this.dx - 25) < 0)){

				this.dx = 0;

	    }

			if(((futureY + this.dy + 25) > Game.arenaSize || (futureY + this.dy - 25) < 0)){

				this.dy = 0;

	    }

		}

		render(xc, yc){

			var color = Game.userColor;

			this.image = new createjs.Bitmap(Visuals.getPlayerImage(color));
			containers.playerHolder.addChild(this.image);

			this.image.x = xc;
			this.image.y = yc;

			this.image.regX = 30;
			this.image.regY = 30;

			if(settings.showNames){

				this.txt = new createjs.Text(this.name, "20px Helvetica", "#FFFFFF");
				this.txt.alpha = .4;
				this.txt.textAlign = "center";
				containers.nameHolder.addChild(this.txt);

				this.txt.x = xc;
				this.txt.y = yc + 75;

			}

			this.color = color;

		}

		//called from ticker

	updatePosition(stage){

		var image = this.image;

		image.x = this.xc;
		image.y = this.yc;

		//name field

		if(settings.showNames){

			var text = this.txt;
			text.x = this.xc;
			text.y = this.yc + 75;

			//small motion on name

			text.x += (-Game.mouseX / 240);
			text.y += (-Game.mouseY / 240);

		}

	}

	updateCameraPosition(stage){

		//set an offset for when the player zooms out

		var xOffset = -(this.xc * Game.zoom) + this.xc,
				yOffset = -(this.yc * Game.zoom) + this.yc;

		stage.x = this.xView + xOffset;
		stage.y = this.yView + yOffset;

	}

	updateToServerPosition(xc, yc, servTime){

		//player recieving regular updates

		createjs.Tween.removeTweens(this);

	  //get number of frames that pass in 50ms

	  var numOfFrames = 50/(1000/Game.fps);

	  //increment position of player to their estimated position in 50ms

	  var newX = xc + (this.dx * numOfFrames),
				newY = yc + (this.dy * numOfFrames),

				viewX = (-xc + (Game.xMax/2)) - (this.dx * numOfFrames),
				viewY = (-yc + (Game.yMax/2)) - (this.dy * numOfFrames),

				lag = Game.getLatency(servTime);

	  createjs.Tween.get(this).to({xc: newX, yc: newY, xView: viewX, yView: viewY}, (50 + lag), createjs.Ease.linear);

	}

	updateToSpawnPoint(xc, yc){

		//player recieving their respawn position

		var viewX = -xc + (Game.xMax/2),
				viewY = -yc + (Game.yMax/2);

		this.render(xc, yc);
		this.deltaPosition();

		this.camera = true;
		this.alive = true;

		this.xView = viewX;
		this.yView = viewY;
		this.xc = xc;
		this.yc = yc;

		//zoom in a little bit to look cool

		Game.scaleArena(1, 1600);

		setTimeout(function(){

			cacheStage.addEventListener("stagemousemove", Game.mouseLoc);
			cacheStage.addEventListener("stagemouseup", Game.fire);

		}, 250);

	}

	reset(){

		this.alive = false;
		this.dx = 0;
		this.dy = 0;
		this.orbitCount = 0;
		this.orbitMax = 5;
		this.maxSpeed = 360;
		this.active = false;

		containers.playerHolder.removeChild(this.image);
		containers.nameHolder.removeChild(this.txt);

		clearInterval(this.calcInterval);

		//put slight timeout on camera to let next interpolation finish

		setTimeout(() => {

			this.camera = false;

		}, 100);

	}

}

class Enemy {

	//enemy players

	constructor(name, color, id, xc, yc){

		this.xc = xc;
		this.yc = yc;
		this.id = id;
		this.color = color;
		this.name = name;
		this.showName = settings.showNames;

	}

	render(){

		this.image = new createjs.Bitmap(Visuals.getPlayerImage(this.color));
		containers.playerHolder.addChild(this.image);

		this.image.alpha = 0;
		Visuals.fadeImg(this.image, 1, 300);

		this.image.regX = 30;
		this.image.regY = 30;

		if(this.showName){

			this.renderName();

		}

	}

	renderName(){

		this.txt = new createjs.Text(this.name, "20px Helvetica", "#FFFFFF");
		this.txt.textAlign = "center";
		this.txt.alpha = .4;
		containers.nameHolder.addChild(this.txt);

	}

	removeName(){

		containers.nameHolder.removeChild(this.txt);

	}

	remove(){

		createjs.Tween.removeTweens(this);
		containers.playerHolder.removeChild(this.image);

		if(this.showName){

			this.removeName();

		}

		delete players[this.id];

	}

	updateToServerPosition(newX, newY, lag){

		createjs.Tween.removeTweens(this);

	  createjs.Tween.get(this).to({xc: newX, yc: newY}, (40 + lag), createjs.Ease.linear);

	}

	updatePosition(){

		var image = this.image;
		var text = this.txt;

		image.x = this.xc;
		image.y = this.yc;

		if(this.showName){

			text.x = this.xc;
			text.y = this.yc + 75;

		}

	}

}

class Electron {

	constructor(id, xc, yc, dx, dy, color){

		this.id = id;
		this.xc = xc;
		this.yc = yc;
		this.dx = dx;
		this.dy = dy;
		this.color = color;
		this.origin = -1;
		this.boundLoc = 0;
		this.mainOrbit = false;

	}

	render(){

		var graphicSrc = Visuals.getElectronGraphics(this.color);

		//fade in the image if player is at main menu

		this.image = new createjs.Shape(graphicSrc);

		//attatch a count to image object since it can get stuck

		this.image.count = 0;

    containers.electronHolder.addChild(this.image);

		//fade in image

		this.image.alpha = 0;
		Visuals.fadeImg(this.image, 1, 400);

		this.lastUpdate = Date.now();

	}

	remove(){

		//remove from stage and clear interval

		if(this.deltaFree){

			clearInterval(this.deltaFree);

		}

		containers.electronHolder.removeChild(this.image);

		delete electrons[this.id];

	}

	init(){

    //when instantiating an electron thats already in orbit, we will
		//need to initiate its fps independent dx and dy
		//we just do this once instead of on an interval

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    this.freeMove(xDelta, yDelta);

	}

	mainMove(){

    var now = Date.now();

    this.delta = now - this.lastUpdate;

    this.lastUpdate = now;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    this.freeMove(xDelta, yDelta);

  }

  freeMove(xDelta, yDelta){

		//movement when not in pull

    this.xc += xDelta;
    this.yc += yDelta;

    //keep in bounds

    var inBound = true;

    if(this.xc < 0 || this.xc > Game.arenaSize){

      this.dx = -this.dx;
      this.boundLoc++;
      inBound = false;

    }

    if(this.yc < 0 || this.yc > Game.arenaSize){

      this.dy = -this.dy;
      this.boundLoc++;
      inBound = false;

    }

    //if object is still in bound, it is NOT stuck behind a wall

    if(inBound){

      this.boundLoc = 0;

    }

    //if it has been out of bound more more than 22 frames, assume its stuck
    //refresh it

    if(this.boundLoc > 22){

      this.remove();

    } else {

			this.positionUpd();

		}

  }

	positionUpd(){

		this.image.x = this.xc;
		this.image.y = this.yc;

	}

	orbit(dirIncrement, cw, dist, dir, origin, color, newDx, newDy, newX, newY){

		this.dirIncrement = dirIncrement;
    this.cw = cw;
  	this.dist = dist;
		this.dir = dir;
		this.newColor = color;
		this.origin = origin;

		//find distance between old electron position and new

		var a = newX - this.xc;
		var b = newY - this.yc;
		var dist = Math.sqrt((a * a) + (b * b));

		//tween if distance is noticable

		if(dist > 25){

			createjs.Tween.get(this).to({
				xc: newX, yc: newY, dx: newDx, dy: newDy
			}, 150, createjs.Ease.linear);

		} else {

			this.xc = newX;
			this.yc = newY;
			this.dx = newDx;
			this.dy = newDy;

		}

		//shift color

		this.shiftColor();

		if(this.deltaFree){

			clearInterval(this.deltaFree);

		}

		this.lastUpdate = Date.now();

	}

	//called from ticker

	deltaOrbit(){

		var now = Date.now();

		this.delta = now - this.lastUpdate;

		this.lastUpdate = now;

		var dirDelta = this.dirIncrement * (this.delta/1000);

		this.orbitMove(dirDelta);

	}

	orbitMove(dirDelta){

		//find source player

		var sourcePl = players[this.origin];

		if(sourcePl){

			var originX = sourcePl.xc,
					originY = sourcePl.yc,
					degrees = this.dir - 90,
					radians = degrees / 180 * Math.PI,
					dx = Math.cos(radians),
			 		dy = Math.sin(radians);

			this.xc = originX + dx * this.dist;
			this.yc = originY + dy * this.dist;

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

			this.positionUpd();

		}

	}

	free(){

		this.mainMove();
		this.origin = -1;

	}

	fire(dx, dy, xc, yc){

		this.dx = dx;
		this.dy = dy;
		this.xc = xc;
		this.yc = yc;

		//let it move freely after teen is over

		this.free();

		//interupt any current color intervals

		if(this.colorInterval){

			this.interruptColor();

		}

		this.charge();

	}

	setSlowdownSpeed(dx, dy){

		this.dx = dx;
		this.dy = dy;

  }

	fadeOut(){

		Visuals.fadeImg(this.image, 0, 100);

	}

	shiftColor(){

		//if color is currently shifting, cancel it

		if(this.colorInterval){

			clearInterval(this.colorInterval);

		}

		if(this.color !== this.newColor){

			var fadeColor = Visuals.getRGBA(this.color);
			var targetColor = Visuals.getRGBA(this.newColor);

			//tween the color

			createjs.Tween.get(fadeColor).to(
				{r: targetColor.r, g: targetColor.g, b: targetColor.b}, 500, createjs.Ease.linear);

			//then redraw the shape on interval

			this.colorInterval = setInterval(() => {

				this.reRender(fadeColor);

			}, 1000/Game.fps);

			//clear the interval after half a second

			setTimeout(() => {

				this.color = this.newColor;

				//remove interval

				clearInterval(this.colorInterval);
				this.colorInterval = null;

				createjs.Tween.removeTweens(fadeColor);

				setTimeout(() => {

					//ensure color is accurate

					this.correctColor();

				}, 1500);

			}, 500);

		} else {

			this.reRender(Visuals.getRGBA(this.newColor));

		}

	}

	interruptColor(){

		//if the interval is disrupted (player fires quickly into interval)

		//we need to decide which color the electron is closest to
		//we can use the iterations to decide

		clearInterval(this.colorInterval);

		this.reRender(Visuals.getRGBA(this.newColor));

		this.color = this.newColor;

	}

	reRender(color){

		var i;

		for(i in color){

			color[i] = Math.trunc(color[i]);

		}

		containers.electronHolder.removeChild(this.image);

		var newGraphic = Visuals.electronGraphic(color, 10);

		this.image = new createjs.Shape(newGraphic);

		this.image.count = 0;

		containers.electronHolder.addChild(this.image);

	}

	correctColor(){

		var playerColor = players[this.origin];

		if(playerColor){

			var color = playerColor.color;

			var newGraphic = Visuals.getElectronGraphics(color);

			containers.electronHolder.removeChild(this.image);

			this.image = new createjs.Shape(newGraphic);
			this.image.count = 0;

			containers.electronHolder.addChild(this.image);

		}

	}

	explode(){

		var explosionObject = Visuals.getSmallExplosionGraphics(this.color),
				explSrc = explosionObject.expl, blurSrc = explosionObject.blur,
				expl, blur;

		//animate explosion

		expl = new createjs.Shape(explSrc);

		expl.scaleX = expl.scaleY = 0;
		expl.alpha = 0;
		containers.fxHolder.addChild(expl);

		expl.x = this.xc;
		expl.y = this.yc;

		Visuals.explosionS(expl);
	  Visuals.lensFlareFx(blurSrc, this.xc, this.yc);

		//hide charge (if visible)

		if(this.blur){

			this.removeCharge();

		}

		//remove electron

		this.remove();

	  setTimeout(function(){

	  	containers.fxHolder.removeChild(expl);

	  }, 1000);

	}

	charge(){

		var colorString = Visuals.colorToString(this.color);
		var idString = colorString + 'Charge'
		var blurSrc = graphicsCache[idString];

		this.blur = new createjs.Shape(blurSrc);
		this.blur.alpha = 0;
		containers.fxHolder.addChild(this.blur);

		this.chargeInterval = setInterval(() => {

			this.blur.x = this.xc;
			this.blur.y = this.yc;

		}, 1000/Game.fps);

		Visuals.fadeImg(this.blur, .1, 250);

		setTimeout(() => {

			if(this.blur){

				Visuals.fadeImg(this.blur, 0, 250);

				setTimeout(() => {

					this.removeCharge();

				}, 250);

			}

		}, 1750);

	}

	removeCharge(){

		clearInterval(this.chargeInterval);

		containers.fxHolder.removeChild(this.blur);

		delete this.blur;

	}

}

class Neutron {

	constructor(xc, yc, dx, dy, id){

		this.xc = xc;
		this.yc = yc;
		this.dx = dx;
		this.dy = dy;
		this.id = id;

	}

	render(){

		var src = graphicsCache["neutron"];

		this.image = new createjs.Shape(src);

    containers.neutronHolder.addChild(this.image);

		this.image.alpha = 0;
		Visuals.fadeImg(this.image, 1, 400);

		this.lastUpdate = Date.now();

	}

	move(){

    //fps independency

    var now = Date.now();

    this.delta = now - this.lastUpdate;
    this.lastUpdate = now;

    var xDelta = this.dx * (this.delta/1000);
    var yDelta = this.dy * (this.delta/1000);

    this.deltaMove(xDelta, yDelta);

  }

	deltaMove(xDelta, yDelta){

		//movement when not in pull

		this.xc += xDelta;
		this.yc += yDelta;

		//keep in bounds

		if(this.xc < 0 || this.xc > Game.arenaSize){

      this.dx = -this.dx;

    }

    if(this.yc < 0 || this.yc > Game.arenaSize){

      this.dy = -this.dy;

    }

		this.image.x = this.xc;
		this.image.y = this.yc;

	}

	clear(playerId){

		//first, see if the playerId is valid

		var targetPlayer = players[playerId];

		this.dx = this.dy = 0;

		//tween to target location
		//on an interval, so tween will change if player moves

		var tweenInterval;

		if(targetPlayer){

			tweenInterval = setInterval(() => {

				createjs.Tween.removeTweens(this);
				createjs.Tween.removeTweens(this.image);

				//fade alpha to 0, and fade x and y to target players x and y

				createjs.Tween.get(this).to({xc: targetPlayer.xc, yc: targetPlayer.yc}, 200, createjs.Ease.linear);
				createjs.Tween.get(this.image).to({alpha: 0}, 50, createjs.Ease.linear);

			}, 1000/Game.fps);

			setTimeout(() => {

				//clear intervals, tweens, and remove

				containers.neutronHolder.removeChild(this.image);
				delete neutrons[this.id];
				clearInterval(tweenInterval);

				createjs.Tween.removeTweens(this);
				createjs.Tween.removeTweens(this.image);

			}, 500);

		} else {

			//no target, just remove neutron

			Visuals.fadeImg(this.image, 0, 100);

			setTimeout(() => {

				containers.neutronHolder.removeChild(this.image);
				delete neutrons[this.id];

			}, 100);

		}

	}

	immediateClear(){

		containers.neutronHolder.removeChild(this.image);
		delete neutrons[this.id];

	}

}
