precision highp float;

varying vec2 vUv;

void main(){
    // get world position 
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    
    // project onto plane
    vec3 planeNormal = vec3(0, 0, 1.0);
    vec3 normalProjectedPos = planeNormal * dot(worldPos.xyz, planeNormal) / (length(planeNormal) * length(planeNormal));
    vec3 planeProjectedPos = worldPos.xyz - normalProjectedPos;
    
    // set z-component as world z-component of fluid background
    planeProjectedPos.z = -0.5;

    // transform to vertex position
    vec4 vertexPos = projectionMatrix * modelViewMatrix * vec4( planeProjectedPos, 1.0 );
    
    // calculate uv based on vertex position
    // vUv = vec2(0.5) + vertexPos.xy * 0.5;

    // return vertex position
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position.xy, position.z, 1.0 );
    // gl_Position = vertexPos;
    
     
    
}
