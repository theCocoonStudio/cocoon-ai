precision highp float;
uniform sampler2D field;
uniform float scale;
varying vec2 uvInternal;
varying vec2 vInward;

// GPU Gems ch. 38, Listing 38-5: a boundary cell takes scale times the value
// one cell inside. scale -1 on velocity puts the wall on the face (no-slip);
// scale 1 on pressure makes the gradient across the wall zero (Neumann).
void main(){
    gl_FragColor = scale * texture2D(field, uvInternal + vInward);
}
