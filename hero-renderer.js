// A compact WebGL2 painter for independently animated, rounded image cards.
// It receives screen-space geometry; motion and scene timing live in hero-motion.js.
export function createHeroRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:true});
  if (!gl) return null;
  const vertex = `#version 300 es
  in vec2 corner;
  uniform vec2 viewport;
  uniform vec2 center;
  uniform vec2 halfSize;
  uniform vec2 orientation;
  out vec2 uv;
  out vec2 local;
  void main() {
    local = corner * halfSize;
    vec2 rotated = vec2(local.x * orientation.x - local.y * orientation.y, local.x * orientation.y + local.y * orientation.x);
    vec2 screen = (center + rotated) / viewport;
    gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
    uv = (corner + 1.0) * 0.5;
  }`;
  const fragment = `#version 300 es
  precision highp float;
  uniform sampler2D picture;
  uniform sampler2D previousPicture;
  uniform vec2 viewport;
  uniform vec2 halfSize;
  uniform vec2 aspects;
  uniform float radius;
  uniform float borderWidth;
  uniform float opacity;
  uniform float blend;
  uniform float zoom;
  uniform float blur;
  in vec2 uv;
  in vec2 local;
  out vec4 pixel;
  vec2 cover(float aspect, float magnification) {
    float frame = halfSize.x / halfSize.y;
    vec2 crop = vec2(min(frame / aspect, 1.0), min(aspect / frame, 1.0));
    return (uv - 0.5) * crop / magnification + 0.5;
  }
  void main() {
    float rounded = min(radius, min(halfSize.x, halfSize.y));
    vec2 edge = abs(local) - halfSize + rounded;
    float distance = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - rounded;
    float coverage = 1.0 - smoothstep(-1.0, 1.0, distance);
    if (coverage < 0.001) discard;
    vec3 nextColor = texture(picture, cover(aspects.x, zoom), blur).rgb;
    vec3 oldColor = texture(previousPicture, cover(aspects.y, 1.0)).rgb;
    vec3 color = mix(oldColor, nextColor, blend);
    float stroke = smoothstep(-borderWidth - 1.0, -borderWidth + 1.0, distance);
    color *= 1.0 - 0.12 * stroke;
    vec2 relative = (gl_FragCoord.xy - viewport * 0.5) / (viewport * 0.45);
    float centerMask = clamp((length(relative) - 0.505) / 0.395, 0.0, 1.0);
    float alpha = coverage * opacity * centerMask;
    pixel = vec4(color * alpha, alpha);
  }`;
  const compile = (kind, source) => {
    const shader = gl.createShader(kind); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vs); gl.deleteShader(fs); gl.useProgram(program);
  const names = ['viewport','center','halfSize','orientation','aspects','radius','borderWidth','opacity','blend','zoom','blur','picture','previousPicture'];
  const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'corner'); gl.enableVertexAttribArray(corner); gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(uniforms.picture, 0); gl.uniform1i(uniforms.previousPicture, 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST); gl.clearColor(0,0,0,0);
  const textures = new Map();
  function getTexture(image) {
    if (textures.has(image)) return textures.get(image);
    const texture = gl.createTexture();
    const square = document.createElement('canvas'); square.width = square.height = 320;
    square.getContext('2d').drawImage(image, 0, 0, 320, 320);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, square);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(image, texture); return texture;
  }
  return {
    prepare(image) { getTexture(image); },
    clear() {
      gl.viewport(0,0,canvas.width,canvas.height); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program); gl.uniform2f(uniforms.viewport,canvas.width,canvas.height);
    },
    card({image, previous, x, y, width, height, angle, radius, border, alpha, blend, zoom, blur}) {
      const currentTexture = getTexture(image.image), oldTexture = getTexture((previous || image).image);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,currentTexture);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,oldTexture);
      gl.uniform2f(uniforms.center,x,y); gl.uniform2f(uniforms.halfSize,width/2,height/2);
      gl.uniform2f(uniforms.orientation,Math.cos(angle),Math.sin(angle));
      gl.uniform2f(uniforms.aspects,image.ratio,(previous || image).ratio);
      gl.uniform1f(uniforms.radius,radius); gl.uniform1f(uniforms.borderWidth,border);
      gl.uniform1f(uniforms.opacity,alpha); gl.uniform1f(uniforms.blend,blend);
      gl.uniform1f(uniforms.zoom,zoom); gl.uniform1f(uniforms.blur,blur);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    destroy() { for (const texture of textures.values()) gl.deleteTexture(texture); textures.clear(); gl.deleteBuffer(buffer); gl.deleteProgram(program); }
  };
}
