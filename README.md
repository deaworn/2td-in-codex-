# TD Classic (v0.4.0)

Egy könnyed, böngészőben futó tower defense minijáték. Építs különböző tornyokat, indítsd a hullámokat, és védd meg a kristályt a kilenc eltérő ellenfél-hullámtól, köztük egy főellenséggel.

## Futtatás
Nyisd meg az `index.html` fájlt egy modern böngészőben (asztali környezet ajánlott), és kattints a pályára tornyok lerakásához.

### Mobil nézet
- Mobil-first UI: a pálya fix keretben jelenik meg, ikonok jelzik a statokat, a vezérlők gombjai tap-hangolva vannak.
- Érintéssel is lerakhatsz vagy fejleszthetsz tornyokat, a Start / Reset gombok és a segítség panel mobilon is kényelmesen elérhetők.
- A verziószám a játéktér jobb alsó sarkában jelenik meg; minden frissítésnél nő (pl. most: v0.4.0).

## Tornyok
- **Lángtorony (45)**: gyors lövés, egyenes sebzés.
- **Fagyasztó torony (55)**: lassítja a célpontot, közepes sebzés.
- **Szikra torony (70)**: láncsebzést okoz a közelben lévő második célpontra is.
- Építéskor a pályán szellemkép mutatja a hatótávot és a foglaltságot; csak a zöld útvonalon kívül helyezhető el torony.
- Hullámok után fejlesztési pontot kapsz, a főellenség további +2 pontot ad; kattints egy meglévő toronyra a pályán a szintlépéshez.

## Fejlesztések
- Fejlesztés költsége: 1 pont / szint. Hullám vége: +1 pont, főellenség: +2 pont.
- Minden szint bónusza: +15% sebzés, +6% hatótáv, +0.07 tűzgyorsaság a toronyhoz és a lövedékhez.
