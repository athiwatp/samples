/// <reference types="@argonjs/argon"/>
/// <reference types="three"/>
/// <reference types="stats" />
// set up Argon
var app = Argon.init(null, { 'sharedCanvas': true }, null);
// this app uses geoposed content, so subscribe to geolocation updates
app.context.subscribeGeolocation();
// set up THREE.  Create a scene, a perspective camera and an object
// for the user's location
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera();
var stage = new THREE.Object3D;
scene.add(camera);
scene.add(stage);
// We use the standard WebGLRenderer when we only need WebGL-based content
var renderer = new THREE.WebGLRenderer({
    alpha: true,
    logarithmicDepthBuffer: true,
    antialias: Argon.suggestedWebGLContextAntialiasAttribute
});
renderer.autoClear = false;
var hud = new THREE.CSS3DArgonHUD();
//  We also move the description box to the left Argon HUD.  
// We don't duplicated it because we only use it in mono mode
var holder = document.createElement('div');
var hudDescription = document.getElementById('description');
var hudButtons = document.getElementById('hud');
holder.appendChild(hudDescription);
holder.appendChild(hudButtons);
hud.hudElements[0].appendChild(holder);
// add a performance stats thing to the display
var stats = new Stats();
hud.hudElements[0].appendChild(stats.dom);
// app.view.element.appendChild(hud.domElement);
// set the layers of our view
app.view.setLayers([
    { source: renderer.domElement },
    { source: hud.domElement }
]);
// add some ambient so things aren't so harshly illuminated
var ambientlight = new THREE.AmbientLight(0x909090); // soft white ambient light 
scene.add(ambientlight);
// create 6 3D words for the 6 directions.  
var loader = new THREE.FontLoader();
loader.load('../resources/fonts/helvetiker_regular.typeface.json', function (font) {
    var textOptions = {
        font: font,
        size: 0.15,
        height: 0.1,
        curveSegments: 5,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelEnabled: true
    };
    var textMaterial = new THREE.MeshStandardMaterial({
        color: 0x5588ff
    });
    function createDirectionLabel(text, position, rotation) {
        var textGeometry = new THREE.TextGeometry(text, textOptions);
        textGeometry.center();
        var textMesh = new THREE.Mesh(textGeometry, textMaterial);
        if (position.x)
            textMesh.position.x = position.x;
        if (position.y)
            textMesh.position.y = position.y;
        if (position.z)
            textMesh.position.z = position.z;
        if (rotation.x)
            textMesh.rotation.x = rotation.x;
        if (rotation.y)
            textMesh.rotation.y = rotation.y;
        if (rotation.z)
            textMesh.rotation.z = rotation.z;
        stage.add(textMesh);
    }
    createDirectionLabel("North", { z: -1 }, {});
    createDirectionLabel("South", { z: 1 }, { y: Math.PI });
    createDirectionLabel("East", { x: 1 }, { y: -Math.PI / 2 });
    createDirectionLabel("West", { x: -1 }, { y: Math.PI / 2 });
    createDirectionLabel("Up", { y: 1 }, { x: Math.PI / 2 });
    createDirectionLabel("Down", { y: -1 }, { x: -Math.PI / 2 });
});
// the updateEvent is called each time the 3D world should be
// rendered, before the renderEvent.  The state of your application
// should be updated here.
app.updateEvent.addEventListener(function () {
    // get the position and orientation of the "stage",
    // to anchor our content. The "stage" defines an East-Up-South
    // coordinate system (assuming geolocation is available).
    var stagePose = app.context.getEntityPose(app.context.stage);
    // assuming we know the user's pose, set the position of our 
    // THREE user object to match it
    if (stagePose.poseStatus & Argon.PoseStatus.KNOWN) {
        stage.position.copy(stagePose.position);
        stage.quaternion.copy(stagePose.orientation);
    }
});
// renderEvent is fired whenever argon wants the app to update its display
app.renderEvent.addEventListener(function () {
    if (app.reality.isSharedCanvas) {
        // if this is a shared canvas we can't depend on our GL state
        // being exactly how we left it last frame
        renderer.resetGLState();
    }
    else {
        // not a shared canvas, we need to clear it before rendering
        renderer.clear();
    }
    // set the renderer to know the current size of the viewport.
    // This is the full size of the viewport, which would include
    // both views if we are in stereo viewing mode
    var view = app.view;
    renderer.setSize(view.renderWidth, view.renderHeight, false);
    renderer.setPixelRatio(app.suggestedPixelRatio);
    var viewport = view.viewport;
    hud.setSize(viewport.width, viewport.height);
    // There is 1 subview in monocular mode, 2 in stereo mode.
    // If we are in mono view, show the description.  If not, hide it, 
    if (app.view.subviews.length > 1) {
        holder.style.display = 'none';
    }
    else {
        holder.style.display = 'block';
    }
    // there is 1 subview in monocular mode, 2 in stereo mode    
    for (var _i = 0, _a = app.view.subviews; _i < _a.length; _i++) {
        var subview = _a[_i];
        // set the position and orientation of the camera for 
        // this subview
        camera.position.copy(subview.pose.position);
        camera.quaternion.copy(subview.pose.orientation);
        // the underlying system provide a full projection matrix
        // for the camera. 
        camera.projectionMatrix.fromArray(subview.frustum.projectionMatrix);
        // set the viewport for this view
        var _b = subview.renderViewport, x = _b.x, y = _b.y, width = _b.width, height = _b.height;
        renderer.setViewport(x, y, width, height);
        // set the webGL rendering parameters and render this view
        renderer.setScissor(x, y, width, height);
        renderer.setScissorTest(true);
        renderer.render(scene, camera);
        // adjust the hud
        var _c = subview.viewport, x = _c.x, y = _c.y, width = _c.width, height = _c.height;
        hud.setViewport(x, y, width, height, subview.index);
        hud.render(subview.index);
    }
    stats.update();
});
// Tango functionailities
// --------------------------
var tangoRealitySession;
app.reality.connectEvent.addEventListener(function (session) {
    // check if the connected supports our protocol
    if (session.supportsProtocol('ar.tango')) {
        // save a reference to this session so our buttons can send messages
        tangoRealitySession = session;
        document.getElementById('menu').style.visibility = 'visible';
        var cloudBtn_1 = document.getElementById('pointcloud-btn');
        var placeBtn = document.getElementById('placeobject-btn');
        var occlusionBtn_1 = document.getElementById('occlusion-btn');
        // Toggle point cloud vision on/off
        cloudBtn_1.addEventListener('click', function () {
            if (tangoRealitySession) {
                tangoRealitySession.request('ar.tango.togglePointCloud')
                    .then(function (_a) {
                    var isOn = _a.result;
                    cloudBtn_1.textContent = "PointCloud: " + (isOn ? 'ON' : 'OFF');
                });
            }
        });
        // Place an object at the surface located on the center of the screen.
        placeBtn.addEventListener('click', function () {
            if (tangoRealitySession) {
                placeObject({ x: 0.5, y: 0.5 });
            }
        });
        occlusionBtn_1.addEventListener('click', function () {
            if (tangoRealitySession) {
                tangoRealitySession.request('ar.tango.toggleOcclusion')
                    .then(function (_a) {
                    var isOn = _a.result;
                    occlusionBtn_1.textContent = "Occlusion: " + (isOn ? 'ON' : 'OFF');
                });
            }
        });
    }
});
// Create a cube model of 10 cm size.
var MODEL_SIZE_IN_METERS = 0.1;
var model = new THREE.Mesh(new THREE.ConeBufferGeometry(MODEL_SIZE_IN_METERS / 2, MODEL_SIZE_IN_METERS), new THREE.MeshLambertMaterial({ color: 0x888888 }));
// Apply a rotation to the model so it faces in the direction of the
// normal of the plane when the picking based reorientation is done
model.geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(THREE.Math.degToRad(-90)));
// Set a default position (10 meters above the user)
model.position.set(0, 10, 0);
scene.add(model);
function placeObject(pos2D) {
    if (tangoRealitySession) {
        tangoRealitySession.request('ar.tango.getPickingPointAndPlaneInPointCloud', { x: pos2D.x, y: pos2D.y })
            .then(function (_a) {
            var point = _a.point, plane = _a.plane;
            if (point && plane) {
                var pointAndPlane = { point: ObjToFloatArray(point, 3), plane: ObjToFloatArray(plane, 4) };
                THREE.WebAR.positionAndRotateObject3DWithPickingPointAndPlaneInPointCloud(pointAndPlane, model, MODEL_SIZE_IN_METERS / 2);
            }
            else {
                console.warn("Point could not be specified in the point cloud.");
            }
        });
    }
    else {
        console.warn("Reality not connect. Try again in a moment.");
    }
}
function ObjToFloatArray(obj, len) {
    var arr = new Float32Array(len);
    for (var i = 0; i < len; i++) {
        arr[i] = obj[i];
    }
    return arr;
}
