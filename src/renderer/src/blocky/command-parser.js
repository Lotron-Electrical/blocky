export const DEFAULT_PARAMS = {
  name: "BLOCKY",
  skinColor: "#00ff88",
  eyeColor: "#00ff88",
  mouthColor: "#00ff88",
  glowColor: "#00ff8844",
  eyeStyle: "dot",
  mouthStyle: "neutral",
  accessory: "none",
  animation: "none",
  animSpeed: 1,
  blinkRate: 3200,
};

export function parseCommand(input) {
  const l = input.toLowerCase().trim();
  const c = {};
  const u = [];
  const colors = {
    red: "#ff4444",
    green: "#00ff88",
    blue: "#5588ff",
    yellow: "#ffdd00",
    orange: "#ff8800",
    purple: "#bb44ff",
    pink: "#ff66aa",
    cyan: "#00ddff",
    white: "#eeeeff",
    brown: "#aa7744",
    gold: "#ffd700",
    lime: "#88ff00",
    teal: "#00aa88",
    magenta: "#ff00ff",
    coral: "#ff7766",
    lavender: "#bb99ff",
    mint: "#66ffcc",
    salmon: "#ff8877",
    crimson: "#cc2244",
    amber: "#ffbb00",
  };
  for (const [n, h] of Object.entries(colors)) {
    if (l.includes(n)) {
      if (l.includes("eye")) {
        c.eyeColor = h;
        u.push(`eyes → ${n}`);
      } else if (l.includes("mouth")) {
        c.mouthColor = h;
        u.push(`mouth → ${n}`);
      } else {
        c.skinColor = h;
        c.eyeColor = h;
        c.mouthColor = h;
        c.glowColor = h + "44";
        u.push(`color → ${n}`);
      }
    }
  }
  const eyeMap = {
    "heart eye": "heart",
    "star eye": "star",
    "dead eye": "dead",
    cool: "cool",
    wink: "wink",
    dizzy: "dizzy",
    "wide eye": "wide",
    squint: "squint",
    roll: "roll",
  };
  for (const [k, v] of Object.entries(eyeMap)) {
    if (l.includes(k)) {
      c.eyeStyle = v;
      u.push(`eyes → ${v}`);
    }
  }
  const mouthMap = {
    smile: "smile",
    frown: "frown",
    grin: "grin",
    "open mouth": "open",
    teeth: "teeth",
    blep: "blep",
    tongue: "blep",
    smirk: "smirk",
  };
  for (const [k, v] of Object.entries(mouthMap)) {
    if (l.includes(k)) {
      c.mouthStyle = v;
      u.push(`mouth → ${v}`);
    }
  }
  const accMap = {
    hat: "hat",
    cap: "hat",
    crown: "crown",
    king: "crown",
    queen: "crown",
    horn: "horns",
    halo: "halo",
    angel: "halo",
    antenna: "antenna",
    alien: "antenna",
    headphone: "headphones",
    music: "headphones",
  };
  for (const [k, v] of Object.entries(accMap)) {
    if (l.includes(k)) {
      c.accessory = v;
      u.push(`accessory → ${v}`);
    }
  }
  if (l.match(/no (hat|crown|horn|halo|antenna|headphone|accessor)/)) {
    c.accessory = "none";
    u.push("accessory removed");
  }

  const animMap = {
    dance: "dance",
    dancing: "dance",
    bounce: "bounce",
    jump: "bounce",
    wiggle: "wiggle",
    wobble: "wiggle",
    nod: "nod",
    spin: "spin",
    rotate: "spin",
    breathe: "breathe",
    chill: "breathe",
    vibrate: "vibrate",
    shake: "vibrate",
    shiver: "vibrate",
  };
  for (const [k, v] of Object.entries(animMap)) {
    if (l.includes(k)) {
      c.animation = v;
      u.push(`animation → ${v}`);
    }
  }
  if (l.match(/stop|still|freeze/)) {
    c.animation = "none";
    u.push("animation stopped");
  }
  if (l.includes("faster") || l.includes("speed up") || l.includes("turbo")) {
    c.animSpeed = (c.animSpeed || 1) * 2.5;
    u.push("speed ↑↑");
  }
  if (l.includes("slower") || l.includes("slow down")) {
    c.animSpeed = 0.4;
    u.push("speed ↓");
  }

  // Mood combos
  if (l.includes("angry") || l.includes("mad")) {
    return {
      c: {
        eyeStyle: "squint",
        mouthStyle: "teeth",
        skinColor: "#ff4444",
        eyeColor: "#ff4444",
        mouthColor: "#ff4444",
        glowColor: "#ff444444",
        animation: "vibrate",
        animSpeed: 1,
      },
      u: ["ANGRY MODE"],
    };
  }
  if (l.includes("excited") || l.includes("hyped")) {
    return {
      c: {
        eyeStyle: "star",
        mouthStyle: "grin",
        skinColor: "#ffdd00",
        eyeColor: "#ffdd00",
        mouthColor: "#ffdd00",
        glowColor: "#ffdd0044",
        animation: "bounce",
        animSpeed: 1.5,
      },
      u: ["EXCITED MODE"],
    };
  }
  if (l.includes("love") || l.includes("adorable")) {
    return {
      c: {
        eyeStyle: "heart",
        mouthStyle: "smile",
        skinColor: "#ff66aa",
        eyeColor: "#ff66aa",
        mouthColor: "#ff66aa",
        glowColor: "#ff66aa44",
        animation: "breathe",
        animSpeed: 0.8,
      },
      u: ["LOVE MODE"],
    };
  }
  if (l.includes("sleepy") || l.includes("tired")) {
    return {
      c: {
        eyeStyle: "squint",
        mouthStyle: "o",
        animation: "breathe",
        animSpeed: 0.5,
      },
      u: ["sleepy mode"],
    };
  }
  if (l.includes("confused") || l.includes("puzzled")) {
    return {
      c: {
        eyeStyle: "roll",
        mouthStyle: "smirk",
        animation: "wiggle",
        animSpeed: 0.7,
      },
      u: ["confused mode"],
    };
  }
  if (l.includes("party") || l.includes("rave")) {
    return {
      c: {
        eyeStyle: "star",
        mouthStyle: "grin",
        accessory: "crown",
        animation: "dance",
        animSpeed: 1.5,
        skinColor: "#ff66aa",
        eyeColor: "#ffdd00",
        mouthColor: "#00ddff",
        glowColor: "#ff66aa44",
      },
      u: ["PARTY MODE"],
    };
  }
  if (l.includes("hacker") || l.includes("matrix")) {
    return {
      c: {
        skinColor: "#00ff88",
        eyeColor: "#00ff88",
        mouthColor: "#00ff88",
        glowColor: "#00ff8844",
        eyeStyle: "cool",
        mouthStyle: "smirk",
        animation: "breathe",
        animSpeed: 0.6,
      },
      u: ["HACKER MODE"],
    };
  }
  if (l.includes("robot") || l.includes("mech")) {
    return {
      c: {
        skinColor: "#aabbcc",
        eyeColor: "#ff4444",
        mouthColor: "#aabbcc",
        glowColor: "#aabbcc44",
        eyeStyle: "wide",
        mouthStyle: "teeth",
        accessory: "antenna",
        animation: "nod",
        animSpeed: 0.5,
      },
      u: ["ROBOT MODE"],
    };
  }
  if (l.match(/reset|default|normal/)) {
    return { c: { ...DEFAULT_PARAMS }, u: ["reset to defaults"] };
  }
  const nameMatch = l.match(
    /(?:call (?:you|yourself|blocky|him|her|it)|rename|name is|you(?:'re| are)) (.+)/,
  );
  if (nameMatch) {
    c.name = nameMatch[1].toUpperCase().slice(0, 14);
    u.push(`name → ${c.name}`);
  }

  return { c, u };
}
