# TD Classic (v0.6.2)

Egy könnyed, böngészőben futó tower defense minijáték. Építs különböző tornyokat, indítsd a hullámokat, és védd meg a kristályt a kilenc eltérő ellenfél-hullámtól, köztük egy főellenséggel.

## Futtatás
Nyisd meg az `index.html` fájlt egy modern böngészőben (asztali környezet ajánlott), és kattints a pályára tornyok lerakásához.

### Mobil nézet
- Fix 1920x1080-as játéktér egyetlen keretben (a viewporthoz skálázva), a teljes UI ezen belül helyezkedik el.
- Ikonos stat-sáv, jobb oldali toronypanel és alsó HUD gombokkal; érintésre és egérre is optimalizálva.
- A verziószám a játéktér jobb alsó sarkában jelenik meg; minden frissítésnél nő (pl. most: v0.6.2).

## Tornyok
- **Lángtorony (45)**: gyors lövés, egyenes sebzés.
- **Fagyasztó torony (55)**: lassítja a célpontot, közepes sebzés.
- **Szikra torony (70)**: láncsebzést okoz a közelben lévő második célpontra is.
- Építéskor a pályán szellemkép mutatja a hatótávot és a foglaltságot; csak a zöld útvonalon kívül helyezhető el torony.
- Hullámok után fejlesztési pontot kapsz, a főellenség további +2 pontot ad; kattints egy meglévő toronyra a pályán a szintlépéshez.

## Fejlesztések
- Fejlesztés költsége: 1 pont / szint. Hullám vége: +1 pont, főellenség: +2 pont.
- Minden szint bónusza: +15% sebzés, +6% hatótáv, +0.07 tűzgyorsaság a toronyhoz és a lövedékhez.
