//===========
//  Globals
//===========
//Parsed json data file w/ map positions & other node data
// let mapData;
//The main sprite for the Atlas. (background image)
let atlasSprite;
//Self explanatory.
let linesContainer;
let nodesContainer;
//Render Toggles
let boolDrawLines = true;
let boolDrawNodes = true;
let boolNodeHover = true;
let boolDrawNames = true;
let boolDrawTiers = true;


//Create the Pixi Application
let maxH = 2304;
let maxW = 4096;
let pixiScreenW = 2304;
let pixiScreenH = 4096;
let pixiAtlasH = 2304;
let pixiAtlasW = 4096;
var CONTAINER;

var app =  new PIXI.Application({
    width: pixiAtlasW,
    height: pixiAtlasH,
    autoStart: true,
    antialias: true,
    sharedLoader: true,
    sharedTicker: true,
    resizeTo: window
});
let stage = app.stage;

//Load Pixi resources
const loader = PIXI.Loader.shared;
loader.onProgress.add(loadProgressHandler);
loader.onComplete.add(createPixiView);
loader
    .add("img/Atlas.jpg")
    .add("img/line.png")
    .add("img/line_backgroundfill.png")
    .load(setup);

//The center position of the PIXI canvas. Updates automatically when resized.
let midx = 0;
let midy = 0;

//===========
// Functions
//===========
function loadProgressHandler() {

}
function setup(loader, resources) {
    //==================
    //  Initialization
    //==================
    initPixiDisplayObjects(loader, resources);
    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish
    onWindowResize();
    createPixiView();
    window.addEventListener('resize', onWindowResize);
    loadMapsData();
    initAtlasTierButtons();
    
    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}
function createPixiView() {
    //Add the canvas that Pixi automatically created for you to the HTML document
    CONTAINER = document.getElementById("atlas_of_worlds")
    CONTAINER.appendChild(app.view);
    CONTAINER.lastChild.className = "pixi_atlas_of_worlds";
    
}

function resizePixiDisplayObjects() {
    atlasSprite.scale.copyFrom(getAtlasSpriteScale());
    atlasSprite.position.copyFrom(getAtlasSpritePosition());

    let containerScale = getAtlasContainersScale();
    linesContainer.scale.copyFrom(containerScale);
    nodesContainer.scale.copyFrom(containerScale);

    let containerPos = getAtlasContainersPosition();
    linesContainer.position.copyFrom(containerPos);
    nodesContainer.position.copyFrom(containerPos);
}
function getAtlasContainersScale() {
    return {
        x: maxW/pixiAtlasW,
        y: maxH/pixiAtlasH
    };
}
function getAtlasContainersPosition() {
    return {
        x: 0,
        y: 0
    };
}
function getAtlasSpriteScale() {
    let scaleFactorToAdjustForPixiScreenAspectRatio;
    if (pixiScreenH > pixiScreenW) {
        scaleFactorToAdjustForPixiScreenAspectRatio=(pixiScreenW/pixiAtlasW);
    } else {
        scaleFactorToAdjustForPixiScreenAspectRatio=(pixiScreenH/pixiAtlasH)
    }
    return {
        x: (pixiAtlasW/maxW)/scaleFactorToAdjustForPixiScreenAspectRatio,
        y: (pixiAtlasH/maxH)/scaleFactorToAdjustForPixiScreenAspectRatio
    };
}
function getAtlasSpritePosition() {
    return {
        x: (app.screen.width-pixiAtlasW)/2,
        y: (app.screen.height-pixiAtlasH)/2
    };
}

function initPixiDisplayObjects(loader, resources) {
    //Create main Atlas sprite
    atlasSprite = new PIXI.Sprite(resources["img/Atlas.jpg"].texture);
    
    //Add Atlas sprite to stage
    stage.addChildAt(atlasSprite, 0);

    //Bind input to Atlas
    bindZoomPanInput(atlasSprite, getAtlasSpriteScale, getAtlasSpritePosition);
    initZoomPanInput(app);

    initPixiContainers();
}
function initPixiContainers() {
    //Create main containers for Lines and Nodes
    linesContainer = new PIXI.Container();
    nodesContainer = new PIXI.Container();

    //Add Lines and Nodes containers to stage. (Lines 1st, so that they are in back.)
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(nodesContainer);
}

//Factor by which to multiply node positions from the data file when drawing
var mapScaleFactor;// = pixiAtlasW/maxW*4;//4.05;
const NUM_REGIONS = 8;
const NUM_TIERS = 5;
var regionTiers = [0,0,0,0,0,0,0,0]; //Tiers of each region (array index = regionID)
var regionNodes = [[], [], [], [], [], [], [], []]; //lists of nodes(IDs) in each region
var nodeData;
class NodeData {
    constructor(ID, name, regionID, isUnique, tieredData) {
        this.ID = ID;
        this.name = name;
        this.regionID = regionID;
        this.isUnique = isUnique;
        this.tieredData = tieredData;
    }
}
var nodeNameSprites;
var nodeTierTextures;
// var nodeCircleTexture;
var nodeCircleSprites;
var nodePixiObjects;
class NodePixiObject {
    constructor(nodeContainer, circleSprite, nameSprite, tierSprite) {
        this.container = nodeContainer;
        this.circleSprite = circleSprite;
        this.nameSprite = nameSprite;
        this.tierSprite = tierSprite;
    }
}
//Request map data, parse it, and draw all Atlas regions for the 1st time.
function loadMapsData(loader, resources, atlasSprite) {
    
    let request = new XMLHttpRequest();
    request.open("GET", "data/AtlasNode+WorldAreas_Itemized-1594755436.json", true);
    request.send(null);
    request.onreadystatechange = function() {
        if ( request.readyState === 4 && request.status === 200 ) {
            nodeData = JSON.parse(request.responseText);
            // console.log(mapData);
            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)

            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
                // nodeData.push(new NodeData(
                //     entry.RowID,
                //     entry.Name,
                //     entry.AtlasRegionsKey,
                //     entry.IsUniqueMapArea, [
                //     [entry.X0, entry.Y0, entry.AtlasNodeKeys0, entry.Tier0],
                //     [entry.X1, entry.Y1, entry.AtlasNodeKeys1, entry.Tier1],
                //     [entry.X2, entry.Y2, entry.AtlasNodeKeys2, entry.Tier2],
                //     [entry.X3, entry.Y3, entry.AtlasNodeKeys3, entry.Tier3],
                //     [entry.X4, entry.Y4, entry.AtlasNodeKeys4, entry.Tier4]
                // ]));
                
            }
            preloadStaticGraphics();
            //Draw Atlas Nodes & Lines
            drawAllAtlasRegions();
            //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
            //  http request is async. The resources wouldn't necessarily be loaded when the...
            //  drawAllAtlasRegions function is called.)
        }
    }
}
function preloadStaticGraphics() {

    //Init main container object
    nodePixiObjects = [];
    //Set text display options
    const fontSize = 18;//*mapScaleFactor/4
    const fontFamily = 'Arial';
    const tierFontStyle = 'bold';
    const nameFontStyle = 'bold';
    const textResolution = 3;
    const nameTextStyleBlack = {
        fontFamily : fontFamily,
        fontSize: fontSize-4,
        fontStyle: nameFontStyle,
        fill : 0x000000,
    };

    let nodeCircleGraphs = preloadNodeCircleGraphics();
    let tierTextures = preloadTierTextures(fontSize, fontFamily, tierFontStyle, textResolution);

    for (let i=0; i<nodeData.length; i++) {
        let cNodeData = nodeData[i];
        let cPixiNode = new NodePixiObject();
        cPixiNode.container = new PIXI.Container();
        
        //Load Node Circle Sprites
        if (cNodeData.IsUniqueMapArea) {
            cPixiNode.circleSprite = nodeCircleGraphs.unique.clone();
        } else {
            cPixiNode.circleSprite = nodeCircleGraphs.normal.clone();
        }

        //Load Name Sprites
        let nameSprite = new PIXI.Text(cNodeData.Name, nameTextStyleBlack);
        nameSprite.resolution = textResolution;
        nameSprite.anchor.set(0.5,1);
        cPixiNode.nameSprite = nameSprite;

        //Init Node Tier Sprite
        cPixiNode.tierSprite = new PIXI.Sprite.from(
            tierTextures[cNodeData.TieredData[0].Tier]
        );

        nodePixiObjects.push(cPixiNode);
    }
    // preloadNodeCircleSprites(nodeTextures);
    // preloadNameSprites(fontSize, fontFamily, nameFontStyle, textResolution);
     
    
}
function preloadNodeCircleGraphics() {
    let nodeGraph = new PIXI.Graphics();
    nodeGraph.lineStyle(lineThickness, '0x0', 1, 0.5, false)
        .beginFill('0x555555',1)
        .drawCircle(0, 0, 10);

    let uniqueNodeGraph = new PIXI.Graphics();
    uniqueNodeGraph.lineStyle(lineThickness, '0x0', 1, 0.5, false)
        .beginFill('0x554411',1)
        .drawCircle(0, 0, 10);

    // const renderSize = 128;
    // const scaleMode = PIXI.SCALE_MODES.LINEAR;
    // const res = 1;
    let nodeCircleGraphics = {
        normal: nodeGraph,//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res),
        unique: uniqueNodeGraph//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res)
    };
    // app.renderer.render(nodeGraph, nodeCircleTexture.normal);
    // app.renderer.render(uniqueNodeGraph, nodeCircleTexture.unique);

    return nodeCircleGraphics;
}
function preloadNodeCircleSprites(nodeTextures) {
    nodeCircleSprites = [];
    for (let i=0; i<nodeData.length; i++) {
        if (nodeData[i].IsUniqueMapArea) {
            nodeCircleSprites.push(nodeTextures.unique.clone());
        } else {
            nodeCircleSprites.push(nodeTextures.normal.clone());
        }
    }
}
function preloadNameSprites(fontSize, fontFamily, fontStyle, textResolution) {
    const nameTextStyleBlack = {
        fontFamily : fontFamily,
        fontSize: fontSize-4,
        fontStyle: fontStyle,
        fill : 0x000000,
    };
    
    nodeNameSprites = [];
    for (let i=0; i<nodeData.length; i++) {
        let nameSprite = new PIXI.Text(nodeData[i].Name, nameTextStyleBlack);
        nameSprite.resolution = textResolution;
        nameSprite.anchor.set(0.5,1)
        nodeNameSprites.push(nameSprite)
    }
    
}
function preloadTierTextures(fontSize, fontFamily, fontStyle, textResolution) {
    const textStyleRed = {
        fontFamily: fontFamily,
        fontSize: fontSize*textResolution,
        fontStyle: fontStyle,
        // fill : 0xcc1010,
        fill : 0xee0000,
    };
    const textStyleYellow = {
        fontFamily: fontFamily,
        fontSize: fontSize*textResolution,
        fontStyle: fontStyle,
        fill: 0xdddd00,
    };
    const textStyleWhite = {
        fontFamily: fontFamily,
        fontSize: fontSize*textResolution,
        fontStyle: fontStyle,
        fill: 0xffffff,
    };

    nodeTierTextures = [];
    const textureSize = 64;
    for (let i=1; i<=16; i++) {
        let tierSprite = new PIXI.Text(i);
        tierSprite.resolution = 1//textResolution;
        if (i > 9) {
            tierSprite.style = textStyleRed;
        } else if (i > 5) {
            tierSprite.style = textStyleYellow;
        } else {
            tierSprite.style = textStyleWhite;
        }
        tierSprite.anchor.set(0.5,0.5);
        tierSprite.position.set(textureSize/2, textureSize/2);
        let renderTexture = PIXI.RenderTexture.create({width:textureSize, height:textureSize});
        renderTexture.resolution = 1//textResolution;
        app.renderer.render(tierSprite, renderTexture);

        nodeTierTextures.push(renderTexture);
    }
    return nodeTierTextures;
}

function drawAllAtlasRegions() {
    for(let i=0; i<NUM_REGIONS; i++) {
        drawAtlasRegion(i, false);
    }
}

// Globals
var nodeCenterOffset;// = 25*mapScaleFactor/4;
var nodeRadius;// = 30*mapScaleFactor/4;
var lineThickness;// = 3*mapScaleFactor/4;
const lineColor = 0xffffff;
function drawAtlasRegion(regionID, boolRedrawAdjacent=false) {
    let regionLinesGraph;
    let regionNodesContainer;
    //Remove previous nodes and lines for this region.
    if (nodesContainer.children.length > regionID) {
        // linesContainer.removeChildAt(regionID);
        // nodesContainer.removeChildAt(regionID);
        //This removes all references to the container AND child DisplayObjects, allowing...
        //  the garbage collector to remove them from memory. Simply doing...
        //  container.removeChildAt does not do this
        regionLinesGraph = linesContainer.getChildAt(regionID).clear();//destroy(true, false, false);
        //The nodesContainer can be cached
        regionNodesContainer = nodesContainer.getChildAt(regionID);
        regionNodesContainer.removeChildren();//.destroy(true, false, false);
    } else {
        //init region lines Graphics object (Lines)
        regionLinesGraph = new PIXI.Graphics();
        //init region nodes Graphics object (Nodes)
        regionNodesContainer = new PIXI.Container();
        regionNodesContainer.sortableChildren = true;
        //Add Nodes and Lines to their respective containers and renderedRegion list
        linesContainer.addChildAt(regionLinesGraph, regionID);
        nodesContainer.addChildAt(regionNodesContainer, regionID);
    }
    
    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];

    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let entryID = region[i];

        //Node location and neighbor IDs
        let cNode = getNodeByID(entryID);
        let tieredEntryData = getTieredNodeData(cNode);

        //if node exists at this tier
        if (tieredEntryData.tier>0) {
            //Draw Connecting Lines between nodes (PIXI.Graphics)
            if (boolDrawLines) {
                for (let i=0; i<tieredEntryData.atlasNodeKeys.length; i++) {
                    let adjNodeKey = tieredEntryData.atlasNodeKeys[i];
                    let adjNodeData = getTieredNodeData(getNodeByID(adjNodeKey));

                    //Draw Lines
                    let startX = tieredEntryData.x+nodeCenterOffset,
                        startY = tieredEntryData.y+nodeCenterOffset
                        endX = adjNodeData.x+nodeCenterOffset,
                        endY = adjNodeData.y+nodeCenterOffset;
                    // let dX = endX-startX,
                    //     dY = endY-startY;
                    // let angle = Math.atan2(dY, dX);

                    // let lineTexStyle = {
                    //     width: lineThickness*0.8,
                    //     texture: app.loader.resources["img/line.png"].texture,
                    //     alignment: 1,
                    //     matrix: new PIXI.Matrix(.5,0, 0,.5, 0,0).rotate(angle),//.translate(dX/4,dY/4)
                    // }

                    // regionLinesGraph.lineTextureStyle(lineTexStyle)
                    regionLinesGraph.lineStyle(lineThickness, lineColor)
                        .moveTo(startX, startY)
                        .lineTo(endX, endY);

                    //Redraw adjacent region if not already done.
                    let adjNodeRegionKey = getNodeByID(adjNodeKey).AtlasRegionsKey;
                    if (boolRedrawAdjacent && regionsRedrawn[adjNodeRegionKey] === false) {
                        regionsRedrawn[adjNodeRegionKey] = true;
                        drawAtlasRegion(adjNodeRegionKey);
                    }
                }
            }

            //Draw Nodes on 'regionNodesGraph'
            if (boolDrawNodes) {

                let nodePixiObj = nodePixiObjects[entryID];
                let nodeContainer = nodePixiObj.container;
                nodeContainer.position.set(tieredEntryData.x+nodeCenterOffset, tieredEntryData.y+nodeCenterOffset)
                let circleSprite = nodePixiObj.circleSprite;
                circleSprite.scale.set(mapScaleFactor.avg, mapScaleFactor.avg);
                if (boolNodeHover) {
                    circleSprite.interactive = true;
                    circleSprite.buttonMode = true;
                    const scaleMult = 1.325;
                    circleSprite.mouseover = function() {
                        nodeContainer.scale.x *=scaleMult;
                        nodeContainer.scale.y *=scaleMult;
                        nodeContainer.zIndex = 1;
                    };
                    circleSprite.mouseout = function(mouseData) {
                        nodeContainer.scale.x /=scaleMult;
                        nodeContainer.scale.y /=scaleMult;
                        nodeContainer.zIndex = 0;
                    }
                }
                nodeContainer.addChild(circleSprite);

                //Add node label text sprites to 'nodeContainer' 
                if (boolDrawNames) {
                    let nameSprite = nodePixiObj.nameSprite;
                    nameSprite.y = 0-(nodeRadius+nodeCenterOffset/4);
                    nodeContainer.addChild(nameSprite);
                }

                //Add node tier text sprites to 'nodeContainer' 
                if (boolDrawTiers) {
                    let tierSprite = nodePixiObj.tierSprite;
                    tierSprite.texture = nodeTierTextures[tieredEntryData.tier-1];
                    var scaleFac = 0.15;
                    tierSprite.scale.set(mapScaleFactor.x*scaleFac, mapScaleFactor.y*scaleFac);
                    tierSprite.anchor.set(0.5,0.5)
                    nodeContainer.addChild(tierSprite);
                }

                regionNodesContainer.addChild(nodeContainer);
            }
        }
        
    }

    //Force immediate stage render
    //TODO see if something like this helps at ALL, or if its actually a hindrance.
    app.renderer.render(stage);
}

// Returns an array of length 3 based on the supplied region tier.
// Format: [node_x_pos, node_y_pos, [list_of_neighbor_node_ids]]
function getNodeByID(nodeID) {
    return nodeData[nodeID];
}
function getNodeRegionTier(nodeObject) {
    return regionTiers[nodeObject.AtlasRegionsKey];
}
class TieredNodeData {
    constructor(tier, atlasNodeKeys, x, y) {
        this.tier = tier;
        this.atlasNodeKeys = atlasNodeKeys;
        this.x = x;
        this.y = y;
    }
}
function getTieredNodeData(node) {
    
    let tData = node.TieredData[regionTiers[node.AtlasRegionsKey]];

    return new TieredNodeData(
        tData.Tier,
        tData.AtlasNodeKeys,
        tData.X*mapScaleFactor.x,
        tData.Y*mapScaleFactor.y
    );
}

function cycleAllAtlasRegionTiers() {
    for(let i=0; i<NUM_REGIONS; i++) {
        cycleAtlasRegionTier(i, false);
    }
    drawAllAtlasRegions();
}

function cycleAtlasRegionTier(regionID, boolDrawRegion=true) {
    if (regionTiers[regionID] < 4) {
        regionTiers[regionID] += 1;
    } else {
        regionTiers[regionID] = 0;
    }
    //Update corresponding button label
    document.getElementsByClassName("watchstone "+regionID)[0].innerHTML
        = "Tier "+regionTiers[regionID];
    
    //Redraw this region & adjacent regions
    if (boolDrawRegion) {
        drawAtlasRegion(regionID, true);
    }
}

//Place Atlas tier buttons, set their click function, and...
// automatically reposition them if window is resized 
function initAtlasTierButtons() {
    
    //init "master" tier button (cycle all nodes) click function
    document.getElementById("master_tier_button")
        .addEventListener("click", cycleAllAtlasRegionTiers);

    //init region ("watchstone") tier buttons click functions
    let watchstoneButtons = document.getElementsByClassName("watchstone");
    for(let i=1; i<watchstoneButtons.length; i++){
        watchstoneButtons[i].addEventListener("click", function() {cycleAtlasRegionTier(i-1);} );
    }
    placeAtlasTierButtonsCircle();
}

//Stores the position of the center of the PIXI canvas, not the window.
function onWindowResize() {
    // let innerHeight = CONTAINER.clientHeight;
    // let innerWidth = CONTAINER.clientWidth;
    let nonAtlasContentHeightSum = document.getElementsByTagName("header")[0].offsetHeight
        + document.getElementsByTagName("footer")[0].offsetHeight;
    let nonAtlasContentWidthSum = 0;
    pixiScreenH = window.innerHeight-nonAtlasContentHeightSum;
    pixiScreenW = window.innerWidth-nonAtlasContentWidthSum;

    if (pixiScreenH > pixiScreenW) {
        pixiAtlasW = pixiScreenW;
        pixiAtlasH = pixiScreenW*(maxH/maxW);
    } else {
        pixiAtlasH = pixiScreenH;
        pixiAtlasW = pixiScreenH*(maxW/maxH);
    }
    
    CONTAINER.style.height = pixiScreenH+'px';
    CONTAINER.style.width = pixiScreenW+'px';
    app.view.style.height = pixiScreenH+'px';
    app.view.style.width = pixiScreenW+'px';
    app.height = pixiScreenH+'px';
    app.width = pixiScreenW+'px';
    app.resize();

    console.log("16/9 = "+ 16/9);
    console.log("max w, h: " + maxW + ", " + maxH
        +"\nRatio: " + maxW/maxH);
    console.log("pixiScreen w, h: " + pixiScreenW + ", " + pixiScreenH
        +"\nRatio: " + pixiScreenW/pixiScreenH);
    console.log("app.screen. w, h: " + app.screen.width + ", " + app.screen.height
        +"\nRatio: " + app.screen.width/app.screen.height);
    console.log("pixiAtlas w, h: " + pixiAtlasW + ", " + pixiAtlasH
        +"\nRatio: " + pixiAtlasW/pixiAtlasH);
    let atlasScale = getAtlasSpriteScale();
    console.log("Atlas size (in theory) x, y: " + atlasScale.x*maxW + ", " +atlasScale.y*maxH 
        +"\nRatio: " + (atlasScale.x*maxW)/(atlasScale.y*maxH));
    let containersScale = getAtlasContainersScale();
    console.log("Containers scale x, y: " + containersScale.x + ", " +containersScale.y 
        +"\nRatio: " + (containersScale.x)/(containersScale.y));
    

    midx = pixiScreenW/2;//+app.view.x;
    midy = pixiScreenH/2;//+app.view.y;

    mapScaleFactor = {
        x: pixiAtlasW/maxW*4,
        y: pixiAtlasH/maxH*4,
        avg: (pixiAtlasW + pixiAtlasH)/(maxH+maxW)*4
    }

    nodeCenterOffset =  25*mapScaleFactor.avg/4;
    nodeRadius = 30*mapScaleFactor.avg/4;
    lineThickness = 3*mapScaleFactor.avg/4;
    
    placeAtlasTierButtonsCircle();
    resizePixiDisplayObjects();
    drawAllAtlasRegions();
}

function removeElementsByClass(className){
    let elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}

//Place atlas tier buttons in center, stacked vertically
function placeAtlasTierButtons() {
    let elements = document.getElementsByClassName("watchstone");
    let btnHeight = elements[0].offsetHeight;
    // let y0 = (elements.length*btnHeight)/2;

    // for(let i=0; i<elements.length; i++){
    //     placeElement(elements[i], midx, midy-y0+i*btnHeight);
    // }
    let buttonsBox = document.getElementById("watchstone_btn_container");
    //buttonsBox.style.width = '100px';
    buttonsBox.style.height = elements.length*btnHeight+'px';
    placeElement(buttonsBox, midx, midy);
}
function placeAtlasTierButtonsCircle() {
    const radius = 100;
    const anglePerItem = Math.PI/4
    let buttonsBox = document.getElementById("watchstone_btn_container");
    //buttonsBox.style.width = '100px';
    buttonsBox.style.height = '100%';
    buttonsBox.style.width = '100%';

    let elements = document.getElementsByClassName("watchstone");
    let btnHeight = elements[0].offsetHeight;
    let btnWidth = elements[0].offsetWidth;

    // let y0 = (elements.length*btnHeight)/2;
    for(let i=0; i<elements.length; i++){
        placeElement(
            elements[i],
            midx+Math.cos(anglePerItem*i)*radius-btnWidth/2,
            midy+Math.sin(anglePerItem*i)*radius-btnHeight/2
        );
    }
    // let buttonsBox = document.getElementById("watchstone_btn_container");
    // //buttonsBox.style.width = '100px';
    // buttonsBox.style.height = elements.length*btnHeight+'px';
    // placeElement(buttonsBox, midx, midy);
}

function placeElementByID(elementID, x_pos, y_pos) {
    placeElement(document.getElementById(elementID), x_pos, y_pos);
}

function placeElement(element, x_pos, y_pos) {
    element.style.position = "absolute";
    element.style.left = x_pos+'px';
    element.style.top = y_pos+'px';
}


// ===============================
// Notes and currently unused
// ===============================
// function clearPixiViews() {
//     removeElementsByClass("pixi_atlas_of_worlds");
// }

let directionMult = 1;
function animationLoop(delta) {
    
    // let lib = stage.getChildAt(1);
    
    // if (lib.y < 0 || lib.y > 100) {
    //     directionMult *= -1;
    // }
    
    // lib.y += 1*directionMult;

}
