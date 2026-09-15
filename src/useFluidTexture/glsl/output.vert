uniform vec2 px;
varying vec2 uvInternal;

precision highp float;

// The picture is the interior: the rim is the wall's, not the fluid's, so the
// full quad samples the cells inside it.
void main(){
    vec2 uv = 0.5 + position.xy * 0.5;
    uvInternal = mix(px, 1.0 - px, uv);
    gl_Position = vec4(position, 1.0);
}
