precision highp float;

uniform vec2 force;
varying vec2 vUv;

void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    
    
    gl_FragColor = vec4(force * -1.0 * circle , 0, 1);
}
