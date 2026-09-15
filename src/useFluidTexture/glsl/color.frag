precision highp float;
uniform sampler2D velocity;
varying vec2 uvInternal;

void main(){
    vec2 vel = texture2D(velocity, uvInternal).xy;
    float len = length(vel) / sqrt(2.0) ;
    vel = vel * 0.5 + 0.5;
    
    // vec3 colorInternal = vec3(vel.x, vel.y, 1.0);
    vec3 colorInternal = mix(vec3(1.0), vec3(0.0), len);
    
    // old
    gl_FragColor = vec4(colorInternal,  1.0);

    // new
    // gl_FragColor = vec4(len,len,len,  1.0);
}
