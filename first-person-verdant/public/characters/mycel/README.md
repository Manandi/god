# Mycel · the intro narrator

`mycel.glb` is Mycel, keeper of the Heartseed, built in Blender from
`tools/blender/build_mycel.py`. About 8k triangles, 185 KB, flat materials with
glowing spots, gills, eyes and Heartseed.

```
blender -b --python first-person-verdant/tools/blender/build_mycel.py -- [--preview out.png]
```

He is a floating mushroom spirit: a deep-teal cap with glowing spots and gills,
a pale stem-body with a leafy collar, big glowing eyes, root arms, and root
tendrils in place of legs. The face parts and limbs (`EyeL`, `EyeR`, `BrowL`,
`BrowR`, `Mouth`, `ArmL`, `ArmR`, `Cap`) are separate objects with their
origins at their pivots, so `src/narrator.js` animates them directly: he drifts
around the screen above the story box, blinks, moves his mouth while text
types, and each line sets a mood (brows, eyes, a gesture). The `Heartseed`
orbits him.

The town NPC Mycel (the Rootkeeper in Mossgate) is a separate block figure from
the ChatGPT design and is unchanged.
