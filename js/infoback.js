'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function createPoints(nu) {
  var pts = [];
  var tris = [];
  var normals = [];
  var uv = [];

  function fudge(xyz) {
    var dx = 0.025;
    return [xyz[0] * (1 - dx * 0.5) + dx * Math.random(), xyz[1] * (1 - dx * 0.5) + dx * Math.random(), xyz[2] * (1 - dx * 0.5) + dx * Math.random()];
  }
  function xyz(phi, theta) {
    return [Math.sin(theta) * Math.cos(phi), Math.sin(phi), Math.cos(theta) * Math.cos(phi)];
  }

  for (var i = 0; i < nu; i++) {
    var phi = (-0.5 + (i + 0.5) / nu) * Math.PI;
    var phiL = (-0.5 + i / nu) * Math.PI;
    var phiU = (-0.5 + (i + 1) / nu) * Math.PI;

    var rad = 2 * Math.PI * Math.cos(phi);
    var nv = Math.round(rad / (Math.PI * 2.0) * nu);
    var rand = Math.random();
    for (var j = 0; j < 2 * nv; j++) {
      var theta = (j + rand) / (2 * nv) * Math.PI * 2;
      var thetaL = (j - 0.5 + rand) / (2 * nv) * Math.PI * 2;
      var thetaU = (j + 0.5 + rand) / (2 * nv) * Math.PI * 2;
      var col = Math.random();
      var pCen = xyz(phi, theta, col);
      pts.push(pCen);

      // C D
      // A B
      var pA = xyz(phiL, thetaL);
      var pB = xyz(phiU, thetaL);
      var pC = xyz(phiL, thetaU);
      var pD = xyz(phiU, thetaU);

      var norm = normalize([], cross([], subtract([], fudge(pD), fudge(pA)), subtract([], fudge(pC), fudge(pB))));

      tris.push(pA);
      tris.push(pB);
      tris.push(pC);
      normals.push(norm);
      normals.push(norm);
      normals.push(norm);
      uv.push([-1, -1]);
      uv.push([1, -1]);
      uv.push([-1, 1]);

      tris.push(pD);
      tris.push(pC);
      tris.push(pB);
      normals.push(norm);
      normals.push(norm);
      normals.push(norm);
      uv.push([1, 1]);
      uv.push([-1, 1]);
      uv.push([1, -1]);
    }
  }
  return { pts: pts, tris: tris, normals: normals, uv: uv };
}

function createMatcap(n) {
  var data = new Uint8Array(n * n * 4);
  var hue = Math.random();
  for (var i = 0; i < n * n; i++) {
    var c = hsl2rgb([(hue + 0.4 * Math.random()) % 1.0, 0.5, Math.random()]);
    data[4 * i] = c[0] * 256;
    data[4 * i + 1] = c[1] * 256;
    data[4 * i + 2] = c[2] * 256;
    data[4 * i + 3] = 1.0;
  }
  return data;
}

function start() {
  createREGL({
    attributes: {/*antialias: false*/},
    pixelRatio: 1.0,
    onDone: function onDone(err, regl) {
      var raySource = regl.framebuffer({
        color: regl.texture({
          width: regl._gl.canvas.width / 2,
          height: regl._gl.canvas.height / 2,
          mag: 'linear',
          min: 'linear'
        })
      });
      var rayAccum = regl.framebuffer({
        color: regl.texture({
          width: regl._gl.canvas.width / 2,
          height: regl._gl.canvas.height / 2,
          mag: 'linear',
          min: 'linear'
        })
      });
      var matcapRes = 9;
      var ballRes = 35;

      var matcaps = new Array(4).fill(0).map(function () {
        return regl.texture({
          data: createMatcap(matcapRes),
          radius: matcapRes,
          min: 'linear',
          mag: 'linear'
        });
      });

      var geom = createPoints(ballRes);
      var camera = reglCamera(regl, {
        damping: 0,
        distance: 7,
        phi: -0.5
      });
      var ident = identity([]);

      var drawBall = regl({
        vert: '\n          precision mediump float;\n          attribute vec3 xyz, normal;\n          varying vec3 color;\n          uniform mat4 model, projection, view, iview;\n          uniform vec3 eye;\n          uniform sampler2D matcapTexture;\n\n          // Source: https://github.com/hughsk/matcap\n          vec2 matcap(vec3 veye, vec3 n) {\n            vec3 reflected = reflect(veye, n);\n            float m = 2.8284271247461903 * sqrt(reflected.z + 1.0);\n            return reflected.xy / m + 0.5;\n          }\n\n          void main () {\n            vec3 veye = normalize(xyz - eye);\n            mat3 view3 = mat3(view);\n            mat3 model3 = mat3(model);\n            color = texture2D(matcapTexture, matcap(view3 * veye, view3 * model3 * normal)).xyz;\n            gl_Position = projection * view * model * vec4(xyz, 1.0);\n          }\n        ',
        frag: '\n          precision mediump float;\nuniform float intens;\n          varying vec3 color;\n          void main () {\n            gl_FragColor = vec4(color * intens, 1.0);\n          }\n        ',
        cull: { enable: true, face: 'front' },
        blend: { enable: false },
        depth: { enable: true },
        attributes: {
          xyz: geom.tris,
          normal: geom.normals
        },
        uniforms: {
          matcapTexture: regl.prop('matcap'),
          intens: regl.prop('intens'),
          iview: function iview(ctx) {
            return invert([], ctx.view);
          },
          model: function model(ctx) {
            return rotateY([], ident, ctx.time * 0.7);
          }
        },
        count: geom.tris.length
      });

      var drawReflections = regl({
        vert: '\n          precision mediump float;\n          attribute vec3 xyz, normal;\n          attribute vec2 uv;\n          varying vec3 color;\n          varying vec2 vuv;\n          varying float dp;\n          uniform mat4 model, projection, view;\n          uniform vec3 eye, origin;\n          uniform sampler2D matcapTexture;\n\n          // Source: https://github.com/hughsk/matcap\n          vec2 matcap(vec3 veye, vec3 n) {\n            vec3 reflected = reflect(veye, n);\n            float m = 2.8284271247461903 * sqrt(reflected.z + 1.0);\n            return reflected.xy / m + 0.5;\n          }\n\n          void main () {\n            vuv = uv;\n            mat3 view3 = mat3(view);\n            mat3 model3 = mat3(model);\n\n            vec3 p = model3 * xyz;\n            vec3 i = normalize(p - origin);\n            vec3 n = normalize(p);\n            vec3 refl = reflect(i, n) * 20.0;\n\n            dp = dot(i, n);\n\n            vec3 veye = normalize(xyz - eye);\n            color = texture2D(matcapTexture, matcap(view3 * veye, view3 * model3 * normal)).xyz;\n\n            gl_Position = projection * view * vec4(refl, 1.0);\n          }\n        ',
        frag: '\n          precision mediump float;\n          varying vec3 color;\n          varying float dp;\n          varying vec2 vuv;\n          void main () {\n            if (dp > 0.0) discard;\n            gl_FragColor = vec4(color, 0.1 * smoothstep(0.0, -0.2, dp) * (1.0 - dot(vuv, vuv)));\n          }\n        ',
        attributes: {
          xyz: geom.tris,
          normal: geom.normals,
          uv: geom.uv
        },
        depth: { enable: false },
        blend: {
          enable: true,
          func: { srcRGB: 'src alpha', srcAlpha: 1, dstRGB: 1, dstAlpha: 1 },
          equation: { rgb: 'add', alpha: 'add' }
        },
        uniforms: {
          matcapTexture: regl.prop('matcap'),
          model: function model(ctx) {
            return rotateY([], ident, ctx.time * 0.7);
          },
          origin: regl.prop('origin')
        },
        count: geom.tris.length
      });

      var transferRays = regl({
        vert: '\n          precision mediump float;\n          attribute vec2 xy;\n          varying vec2 uv;\n          void main () {\n            uv = xy * 0.5 + 0.5;\n            gl_Position = vec4(xy, 0, 1);\n          }\n        ',
        frag: '\n          precision mediump float;\n          uniform sampler2D rayAccum;\n          varying vec2 uv;\n\n          void main () {\n            gl_FragColor = vec4(texture2D(rayAccum, uv).xyz, 1);\n          }\n        ',
        depth: { enable: false },
        blend: {
          enable: true,
          func: { srcRGB: 'src alpha', srcAlpha: 1, dstRGB: 1, dstAlpha: 1 },
          equation: { rgb: 'add', alpha: 'add' }
        },
        uniforms: { rayAccum: rayAccum },
        attributes: { xy: [-4, -4, 0, 4, 4, -4] },
        count: 3
      });

      var drawRays = regl({
        vert: '\n          precision mediump float;\n          attribute vec2 xy;\n          varying vec2 uv;\n          void main () {\n            uv = xy * 0.5 + 0.5;\n            gl_Position = vec4(xy, 0, 1);\n          }\n        ',
        frag: '\n          precision mediump float;\n          uniform sampler2D raySource;\n          uniform float intens;\n          varying vec2 uv;\n          const int numSamples = 70;\n\n          // Source: https://github.com/Erkaman/glsl-godrays\n          vec3 godrays(\n            float density,\n            float weight,\n            float decay,\n            float exposure,\n            vec2 pos,\n            vec2 uv\n          ) {\n            vec3 fragColor = vec3(0.0);\n            vec2 deltaTextCoord = vec2(uv - pos.xy);\n            vec2 tc = uv.xy ;\n            deltaTextCoord *= (1.0 /  float(numSamples)) * density;\n            float illuminationDecay = 1.0;\n            for(int i=0; i < numSamples ; i++){\n              tc -= deltaTextCoord;\n              vec3 samp = texture2D(raySource, tc).xyz;\n              samp *= samp;\n              samp *= samp;\n              samp *= samp;\n              samp *= illuminationDecay * weight;\n              fragColor += samp;\n              illuminationDecay *= decay;\n            }\n            fragColor *= exposure;\n            return fragColor;\n          }\n\n          void main () {\n            gl_FragColor = vec4(godrays(1.0, 0.15, 0.95, 1.8 / intens, vec2(0.5, 0.5), uv), 1);\n          }\n        ',
        depth: { enable: false },
        blend: {
          enable: true,
          func: { srcRGB: 'src alpha', srcAlpha: 1, dstRGB: 1, dstAlpha: 1 },
          equation: { rgb: 'add', alpha: 'add' }
        },
        uniforms: { raySource: raySource, intens: regl.prop('intens') },
        attributes: { xy: [-4, -4, 0, 4, 4, -4] },
        count: 3
      });

      regl.frame(function (_ref) {
        var tick = _ref.tick;
        var time = _ref.time;

        //if (tick % 5 !== 1) return;
        regl.clear({ color: [0, 0, 0, 1] });

        var m = time * 1.7 % 4;
        var m0 = Math.floor(m);
        var matcap = matcaps[m0];
        var intens = Math.exp(-(m - m0) / 5.0);

        camera(function () {
          raySource.use(function () {
            regl.clear({ color: [0, 0, 0, 1], depth: 1 });
            drawBall({ matcap: matcap, intens: intens });
          });
          rayAccum.use(function () {
            regl.clear({ color: [0, 0, 0, 1], depth: 1 });
            drawRays({ intens: intens });
          });
          drawReflections({ origin: [-10, -5, -5], matcap: matcap });
          drawReflections({ origin: [8, -2, 12], matcap: matcap });
          drawReflections({ origin: [4, 5, 6], matcap: matcap });
          drawBall({ matcap: matcap, intens: intens });
          transferRays();
        });
      });
    }
  });
}

// Source: https://github.com/stackgl/gl-mat4/blob/master/invert.js
function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3],
      a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7],
      a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11],
      a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15],
      b00 = a00 * a11 - a01 * a10,
      b01 = a00 * a12 - a02 * a10,
      b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11,
      b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30,
      b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31,
      b10 = a21 * a33 - a23 * a31,
      b11 = a22 * a33 - a23 * a32,

  // Calculate the determinant
  det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
};

// Source: https://github.com/stackgl/gl-mat4/blob/master/identity.js
function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
};

// Source: https://github.com/stackgl/gl-mat4/blob/master/rotateY.js
function rotateY(out, a, rad) {
  var s = Math.sin(rad),
      c = Math.cos(rad),
      a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3],
      a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  // Perform axis-specific matrix multiplication
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
};

// Source: https://github.com/stackgl/gl-vec3/blob/master/subtract.js
function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

// Source: https://github.com/stackgl/gl-vec3/blob/master/cross.js
function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2],
      bx = b[0],
      by = b[1],
      bz = b[2];

  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

// Source: https://github.com/stackgl/gl-vec3/blob/master/normalize.js
function normalize(out, a) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var len = x * x + y * y + z * z;
  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
    out[0] = a[0] * len;
    out[1] = a[1] * len;
    out[2] = a[2] * len;
  }
  return out;
}

// Source: https://github.com/mattdesl/float-hsl2rgb
function hsl2rgb(hsl) {
  var h = hsl[0],
      s = hsl[1],
      l = hsl[2],
      t1,
      t2,
      t3,
      rgb,
      val;

  if (s === 0) {
    val = l;
    return [val, val, val];
  }

  if (l < 0.5) {
    t2 = l * (1 + s);
  } else {
    t2 = l + s - l * s;
  }
  t1 = 2 * l - t2;

  rgb = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
    t3 = h + 1 / 3 * -(i - 1);
    if (t3 < 0) {
      t3++;
    }
    if (t3 > 1) {
      t3--;
    }

    if (6 * t3 < 1) {
      val = t1 + (t2 - t1) * 6 * t3;
    } else if (2 * t3 < 1) {
      val = t2;
    } else if (3 * t3 < 2) {
      val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
    } else {
      val = t1;
    }

    rgb[i] = val;
  }

  return rgb;
}

// regl-camera, bundled:
!function (e) {
  if ("object" == (typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) && "undefined" != typeof module) module.exports = e();else if ("function" == typeof define && define.amd) define([], e);else {
    ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).reglCamera = e();
  }
}(function () {
  return function e(t, n, r) {
    function i(a, u) {
      if (!n[a]) {
        if (!t[a]) {
          var s = "function" == typeof require && require;if (!u && s) return s(a, !0);if (o) return o(a, !0);var d = new Error("Cannot find module '" + a + "'");throw d.code = "MODULE_NOT_FOUND", d;
        }var c = n[a] = { exports: {} };t[a][0].call(c.exports, function (e) {
          var n = t[a][1][e];return i(n || e);
        }, c, c.exports, e, t, n, r);
      }return n[a].exports;
    }for (var o = "function" == typeof require && require, a = 0; a < r.length; a++) {
      i(r[a]);
    }return i;
  }({ 1: [function (e, t, n) {
      t.exports = e("regl-camera");
    }, { "regl-camera": 9 }], 2: [function (e, t, n) {
      t.exports = function (e) {
        return e[0] = 1, e[1] = 0, e[2] = 0, e[3] = 0, e[4] = 0, e[5] = 1, e[6] = 0, e[7] = 0, e[8] = 0, e[9] = 0, e[10] = 1, e[11] = 0, e[12] = 0, e[13] = 0, e[14] = 0, e[15] = 1, e;
      };
    }, {}], 3: [function (e, t, n) {
      var r = e("./identity");t.exports = function (e, t, n, i) {
        var o,
            a,
            u,
            s,
            d,
            c,
            f,
            v,
            l,
            m,
            p = t[0],
            h = t[1],
            y = t[2],
            w = i[0],
            g = i[1],
            b = i[2],
            E = n[0],
            L = n[1],
            x = n[2];return Math.abs(p - E) < 1e-6 && Math.abs(h - L) < 1e-6 && Math.abs(y - x) < 1e-6 ? r(e) : (f = p - E, v = h - L, l = y - x, m = 1 / Math.sqrt(f * f + v * v + l * l), f *= m, v *= m, l *= m, o = g * l - b * v, a = b * f - w * l, u = w * v - g * f, (m = Math.sqrt(o * o + a * a + u * u)) ? (o *= m = 1 / m, a *= m, u *= m) : (o = 0, a = 0, u = 0), s = v * u - l * a, d = l * o - f * u, c = f * a - v * o, (m = Math.sqrt(s * s + d * d + c * c)) ? (s *= m = 1 / m, d *= m, c *= m) : (s = 0, d = 0, c = 0), e[0] = o, e[1] = s, e[2] = f, e[3] = 0, e[4] = a, e[5] = d, e[6] = v, e[7] = 0, e[8] = u, e[9] = c, e[10] = l, e[11] = 0, e[12] = -(o * p + a * h + u * y), e[13] = -(s * p + d * h + c * y), e[14] = -(f * p + v * h + l * y), e[15] = 1, e);
      };
    }, { "./identity": 2 }], 4: [function (e, t, n) {
      t.exports = function (e, t, n, r, i) {
        var o = 1 / Math.tan(t / 2),
            a = 1 / (r - i);return e[0] = o / n, e[1] = 0, e[2] = 0, e[3] = 0, e[4] = 0, e[5] = o, e[6] = 0, e[7] = 0, e[8] = 0, e[9] = 0, e[10] = (i + r) * a, e[11] = -1, e[12] = 0, e[13] = 0, e[14] = 2 * i * r * a, e[15] = 0, e;
      };
    }, {}], 5: [function (e, t, n) {
      "use strict";
      t.exports = function (e, t) {
        function n(e) {
          var t = !1;return "altKey" in e && (t = t || e.altKey !== h.alt, h.alt = !!e.altKey), "shiftKey" in e && (t = t || e.shiftKey !== h.shift, h.shift = !!e.shiftKey), "ctrlKey" in e && (t = t || e.ctrlKey !== h.control, h.control = !!e.ctrlKey), "metaKey" in e && (t = t || e.metaKey !== h.meta, h.meta = !!e.metaKey), t;
        }function i(e, i) {
          var o = r.x(i),
              a = r.y(i);"buttons" in i && (e = 0 | i.buttons), (e !== l || o !== m || a !== p || n(i)) && (l = 0 | e, m = o || 0, p = a || 0, t && t(l, m, p, h));
        }function o(e) {
          i(0, e);
        }function a() {
          (l || m || p || h.shift || h.alt || h.meta || h.control) && (m = p = 0, l = 0, h.shift = h.alt = h.control = h.meta = !1, t && t(0, 0, 0, h));
        }function u(e) {
          n(e) && t && t(l, m, p, h);
        }function s(e) {
          0 === r.buttons(e) ? i(0, e) : i(l, e);
        }function d(e) {
          i(l | r.buttons(e), e);
        }function c(e) {
          i(l & ~r.buttons(e), e);
        }function f() {
          y || (y = !0, e.addEventListener("mousemove", s), e.addEventListener("mousedown", d), e.addEventListener("mouseup", c), e.addEventListener("mouseleave", o), e.addEventListener("mouseenter", o), e.addEventListener("mouseout", o), e.addEventListener("mouseover", o), e.addEventListener("blur", a), e.addEventListener("keyup", u), e.addEventListener("keydown", u), e.addEventListener("keypress", u), e !== window && (window.addEventListener("blur", a), window.addEventListener("keyup", u), window.addEventListener("keydown", u), window.addEventListener("keypress", u)));
        }function v() {
          y && (y = !1, e.removeEventListener("mousemove", s), e.removeEventListener("mousedown", d), e.removeEventListener("mouseup", c), e.removeEventListener("mouseleave", o), e.removeEventListener("mouseenter", o), e.removeEventListener("mouseout", o), e.removeEventListener("mouseover", o), e.removeEventListener("blur", a), e.removeEventListener("keyup", u), e.removeEventListener("keydown", u), e.removeEventListener("keypress", u), e !== window && (window.removeEventListener("blur", a), window.removeEventListener("keyup", u), window.removeEventListener("keydown", u), window.removeEventListener("keypress", u)));
        }t || (t = e, e = window);var l = 0,
            m = 0,
            p = 0,
            h = { shift: !1, alt: !1, control: !1, meta: !1 },
            y = !1;f();var w = { element: e };return Object.defineProperties(w, { enabled: { get: function get() {
              return y;
            }, set: function set(e) {
              e ? f() : v();
            }, enumerable: !0 }, buttons: { get: function get() {
              return l;
            }, enumerable: !0 }, x: { get: function get() {
              return m;
            }, enumerable: !0 }, y: { get: function get() {
              return p;
            }, enumerable: !0 }, mods: { get: function get() {
              return h;
            }, enumerable: !0 } }), w;
      };var r = e("mouse-event");
    }, { "mouse-event": 6 }], 6: [function (e, t, n) {
      "use strict";
      function r(e) {
        return e.target || e.srcElement || window;
      }n.buttons = function (e) {
        if ("object" == (typeof e === 'undefined' ? 'undefined' : _typeof(e))) {
          if ("buttons" in e) return e.buttons;if ("which" in e) {
            if (2 === (t = e.which)) return 4;if (3 === t) return 2;if (t > 0) return 1 << t - 1;
          } else if ("button" in e) {
            var t = e.button;if (1 === t) return 4;if (2 === t) return 2;if (t >= 0) return 1 << t;
          }
        }return 0;
      }, n.element = r, n.x = function (e) {
        if ("object" == (typeof e === 'undefined' ? 'undefined' : _typeof(e))) {
          if ("offsetX" in e) return e.offsetX;var t = r(e).getBoundingClientRect();return e.clientX - t.left;
        }return 0;
      }, n.y = function (e) {
        if ("object" == (typeof e === 'undefined' ? 'undefined' : _typeof(e))) {
          if ("offsetY" in e) return e.offsetY;var t = r(e).getBoundingClientRect();return e.clientY - t.top;
        }return 0;
      };
    }, {}], 7: [function (e, t, n) {
      "use strict";
      var r = e("to-px");t.exports = function (e, t, n) {
        "function" == typeof e && (n = !!t, t = e, e = window);var i = r("ex", e),
            o = function o(e) {
          n && e.preventDefault();var r = e.deltaX || 0,
              o = e.deltaY || 0,
              a = e.deltaZ || 0,
              u = 1;switch (e.deltaMode) {case 1:
              u = i;break;case 2:
              u = window.innerHeight;}if (r *= u, o *= u, a *= u, r || o || a) return t(r, o, a, e);
        };return e.addEventListener("wheel", o), o;
      };
    }, { "to-px": 10 }], 8: [function (e, t, n) {
      t.exports = function (e, t) {
        t || (t = [0, ""]), e = String(e);var n = parseFloat(e, 10);return t[0] = n, t[1] = e.match(/[\d.\-\+]*\s*(.*)/)[1] || "", t;
      };
    }, {}], 9: [function (e, t, n) {
      var r = e("mouse-change"),
          i = e("mouse-wheel"),
          o = e("gl-mat4/identity"),
          a = e("gl-mat4/perspective"),
          u = e("gl-mat4/lookAt");t.exports = function (e, t) {
        function n() {
          return h ? h.offsetWidth : window.innerWidth;
        }function d() {
          return h ? h.offsetHeight : window.innerHeight;
        }function c(e) {
          var t = e * y;return Math.abs(t) < .1 ? 0 : (p.dirty = !0, t);
        }function f(e, t, n) {
          return Math.min(Math.max(e, t), n);
        }function v(e) {
          Object.keys(e).forEach(function (t) {
            p[t] = e[t];
          });var t = p.center,
              n = p.eye,
              r = p.up,
              i = p.dtheta,
              o = p.dphi;p.theta += i, p.phi = f(p.phi + o, -Math.PI / 2, Math.PI / 2), p.distance = f(p.distance + L, b, E), p.dtheta = c(i), p.dphi = c(o), L = c(L);for (var a = p.theta, s = p.phi, d = Math.exp(p.distance), v = d * Math.sin(a) * Math.cos(s), l = d * Math.cos(a) * Math.cos(s), m = d * Math.sin(s), h = 0; h < 3; ++h) {
            n[h] = t[h] + v * g[h] + l * w[h] + m * r[h];
          }u(p.view, n, t, r);
        }function l(e, t) {
          void 0 !== l.dirty && (p.dirty = l.dirty || p.dirty, l.dirty = void 0), e && t && (p.dirty = !0), p.renderOnDirty && !p.dirty || (t || (t = e, e = {}), v(e), S(t), p.dirty = !1);
        }var m = t || {};void 0 === m.noScroll && (m.noScroll = m.preventDefault);var p = { view: o(new Float32Array(16)), projection: o(new Float32Array(16)), center: new Float32Array(m.center || 3), theta: m.theta || 0, phi: m.phi || 0, distance: Math.log(m.distance || 10), eye: new Float32Array(3), up: new Float32Array(m.up || [0, 1, 0]), fovy: m.fovy || Math.PI / 4, near: void 0 !== m.near ? m.near : .01, far: void 0 !== m.far ? m.far : 1e3, noScroll: void 0 !== m.noScroll && m.noScroll, flipY: !!m.flipY, dtheta: 0, dphi: 0, rotationSpeed: void 0 !== m.rotationSpeed ? m.rotationSpeed : 1, zoomSpeed: void 0 !== m.zoomSpeed ? m.zoomSpeed : 1, renderOnDirty: void 0 !== _typeof(m.renderOnDirty) && !!m.renderOnDirty },
            h = m.element,
            y = void 0 !== m.damping ? m.damping : .9,
            w = new Float32Array([1, 0, 0]),
            g = new Float32Array([0, 0, 1]),
            b = Math.log("minDistance" in m ? m.minDistance : .1),
            E = Math.log("maxDistance" in m ? m.maxDistance : 1e3),
            L = 0,
            x = 0,
            M = 0;if (s && !1 !== m.mouse) {
          var k = h || e._gl.canvas;r(k, function (e, t, r) {
            if (1 & e) {
              var i = (t - x) / n(),
                  o = (r - M) / d();p.dtheta += 4 * p.rotationSpeed * i, p.dphi += 4 * p.rotationSpeed * o, p.dirty = !0;
            }x = t, M = r;
          }), i(k, function (e, t) {
            L += t / d() * p.zoomSpeed, p.dirty = !0;
          }, m.noScroll);
        }p.dirty = !0;var S = e({ context: Object.assign({}, p, { dirty: function dirty() {
              return p.dirty;
            }, projection: function projection(e) {
              return a(p.projection, p.fovy, e.viewportWidth / e.viewportHeight, p.near, p.far), p.flipY && (p.projection[5] *= -1), p.projection;
            } }), uniforms: Object.keys(p).reduce(function (t, n) {
            return t[n] = e.context(n), t;
          }, {}) });return Object.keys(p).forEach(function (e) {
          l[e] = p[e];
        }), l;
      };var s = "undefined" != typeof window;
    }, { "gl-mat4/identity": 2, "gl-mat4/lookAt": 3, "gl-mat4/perspective": 4, "mouse-change": 5, "mouse-wheel": 7 }], 10: [function (e, t, n) {
      "use strict";
      function r(e, t) {
        var n = a(getComputedStyle(e).getPropertyValue(t));return n[0] * o(n[1], e);
      }function i(e, t) {
        var n = document.createElement("div");n.style["font-size"] = "128" + e, t.appendChild(n);var i = r(n, "font-size") / 128;return t.removeChild(n), i;
      }function o(e, t) {
        switch (t = t || document.body, e = (e || "px").trim().toLowerCase(), t !== window && t !== document || (t = document.body), e) {case "%":
            return t.clientHeight / 100;case "ch":case "ex":
            return i(e, t);case "em":
            return r(t, "font-size");case "rem":
            return r(document.body, "font-size");case "vw":
            return window.innerWidth / 100;case "vh":
            return window.innerHeight / 100;case "vmin":
            return Math.min(window.innerWidth, window.innerHeight) / 100;case "vmax":
            return Math.max(window.innerWidth, window.innerHeight) / 100;case "in":
            return u;case "cm":
            return u / 2.54;case "mm":
            return u / 25.4;case "pt":
            return u / 72;case "pc":
            return u / 6;}return 1;
      }var a = e("parse-unit");t.exports = o;var u = 96;
    }, { "parse-unit": 8 }] }, {}, [1])(1);
});

start();