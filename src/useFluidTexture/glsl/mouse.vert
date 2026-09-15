precision highp float;

uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;

void main(){
    vec2 pos = position.xy * scale * px + center;
    vUv = uv;
    gl_Position = vec4( min(pos, vec2(1.0,1.0)), 0.0, 1.0 );
}
