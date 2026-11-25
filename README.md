# Apaga el fuego 🧯

Juego web de entrenamiento en el uso del extintor. Aplica la técnica de 4 pasos:

1. Saca el pasador
2. Apunta a la base del fuego
3. Aprieta la palanca
4. Barre de lado a lado, a 2–3 m

## Niveles

| # | Escenario | Clase de fuego |
|---|-----------|----------------|
| 1 | Oficina – papelero en llamas | A |
| 2 | Sala de servidores – rack energizado | C |
| 3 | Casino / cocina – sartén con aceite | K |
| 4 | Taller – líquido inflamable | B |
| 5 | Bodega con humo – ¿apagar o evacuar? | A |

## Controles

- **Móvil:** arrastra para apuntar, mantén *Apretar* para descargar, botones ▲/▼ para acercarte o alejarte.
- **Computador:** mouse para apuntar, clic o barra espaciadora para descargar.

## Jugar

Abre `index.html` en el navegador. No requiere instalación ni dependencias.

### Publicar con GitHub Pages

1. Sube el repositorio a GitHub.
2. En **Settings → Pages**, elige *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. El juego quedará en `https://<usuario>.github.io/<repositorio>/`.

## Estructura

```
index.html      # estructura de la página
css/style.css   # estilos
js/game.js      # lógica del juego, audio y escenas (canvas)
```

> En un incendio real, primero da la alarma y evacúa. Combate solo un fuego pequeño, si sabes cómo hacerlo y tienes la salida despejada a tu espalda.
