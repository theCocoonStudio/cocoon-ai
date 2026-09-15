attribute vec3 position;
attribute vec2 inward;
uniform vec2 px;
varying vec2 uvInternal;
varying vec2 vInward;

precision highp float;

void main(){
    vec3 pos = position;
    // the rim cell's centre, and one cell toward the interior
    uvInternal = 0.5 + pos.xy * 0.5;
    vInward = inward * px;
    vec2 n = sign(pos.xy);
    pos.xy = abs(pos.xy) - px * 1.0;
    pos.xy *= n;
    gl_Position = vec4(pos, 1.0);
}
