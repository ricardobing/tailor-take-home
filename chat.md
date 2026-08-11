# chat.md — Transcripción de la sesión con Claude

Voy a hacer un challenge para un puesto. Necesito que sea lo mas robusto posible. 
Vamos a primero hacer un plan estructurado de lo que se pide. Herramientas a usar. Vamos a hacer un plan detallado de que vamos a construir y porque.
Todo documentado. Evaluo plan y seguimos. Idea es ofrecer siempre un plus a lo que se pide y resolver como si fuera algo real que va a produccion, con test y todo lo que se pueda. nada de simplificar.

Enunciado:
Take-home
Menú de restaurante con carrito de compras, con Google Sheets como backend.
Tiempo
Objetivo menos de 1 hora. Sin tope estricto — puedes tomar más tiempo, pero registramos el tiempo entre la postulación y el momento en que pegas el URL del repo en el formulario. Optimizar el flujo con LLM importa.
Cuándo hacerlo
El take-home es independiente del screening del CV. Puedes hacerlo ahora (y tu postulación pasa al estado take-home enviado apenas pegas la URL del repo) o esperar a que revisemos tu CV y te lo pidamos explícitamente (~5 días hábiles). Ambos caminos son igual de válidos. Si rechazamos en CV no evaluamos el take-home — pero te avisamos en ~5 días para que no quedes esperando.
Stack

* Astro (estático, islands si hace falta).
* Google Sheets como backend — una pestaña para el menú (productos), otra para órdenes.
* Google Apps Script Web App como puente lectura/escritura (doGet devuelve el menú; doPost agrega una fila de orden).
* Claude (Code, web, API — lo que sea) como herramienta. La transcripción completa va en chat.md (ver Entregable).

Qué construir

1. Una página que lea productos de la hoja de menúy, en el README, incluye un párrafo corto con los pasos simples para preparar una pizza y los renderice como tarjetas (nombre, descripción, precio).
2. Un carrito client-side: agregar / quitar ítems, ver subtotales y total.
3. Un botón "Enviar orden" que haga POST del carrito al endpoint de Apps Script, que agrega una fila a la hoja de órdenes (nombre + email del cliente, items en JSON o aplanados, total, timestamp).
4. Desplegar en algo público (GitHub Pages, Vercel, Netlify — tú eliges)y agrega un párrafo corto al README con los pasos simples para preparar una pizza, y poner la URL live en el README.

Qué evaluamos
Las mismas tres dimensiones que en la entrevista:

* Criterio — decisiones visibles en el repo: qué cortaste, qué falseaste, qué documentaste como limitación.
* Autonomía — entregaste algo funcional desde un spec ambiguo sin pedir aclaraciones. Documentar supuestos cuenta más que preguntar.
* Técnico — calidad de código, estructura, tests donde importen, el deploy funciona.

Entregable

1. Repo público en GitHub con el código.
2. README: URL live, un párrafo sobre qué harías con otra hora, lista de supuestos.
3. chat.md en el repo — un copy-paste de toda la conversación que tuviste con Claude (o con el LLM que hayas usado). Un solo archivo, transcripción cruda. Queremos ver prompts, correcciones y callejones sin salida, no un resumen curado.
4. Reabre tu formulario de postulación (con el link de edición de tu email de confirmación) y pega la URL del repo en el campo "URL del repo del take-home".

Reglas

* No hagas preguntas clarificadoras — documenta tus supuestos. El spec es ambiguo a propósito; ese es el test.
* Lee la tarea completa cuidadosamente antes de empezar, y síguela exactamente como está escrita.
* Usa Claude como quieras. Te contratamos para que lo uses, no para esconderlo.

Entendido: el objetivo es un take-home robusto, nivel producción, y arrancamos con un plan documentado que vos evaluás antes de escribir código. Primero miro el estado del directorio y luego escribo el plan.


Ejecutado un comando, creado PLAN.md
+133
-0
El plan está en PLAN.md. Resumen de lo esencial para que lo evalúes:

Trampas detectadas en el enunciado

La instrucción del párrafo de pizza aparece dos veces, incrustada de forma rara — es casi seguro un attention check del "lee cuidadosamente". Lo cumplimos con un párrafo en el README y lo documentamos como supuesto.
chat.md debe ser la transcripción cruda y completa de esta conversación (incluido este plan y cualquier callejón sin salida). No se cura nada.
Miden el tiempo hasta que pegás la URL del repo, así que el plan ordena los pasos para que lo único manual tuyo (lado Google) corra en paralelo con el scaffolding.
Decisiones principales

Astro estático + una sola isla (Preact + nanostores) para carrito/checkout. El menú se pre-renderiza en build con un snapshot, y se revalida en runtime: si Apps Script se cae, la página nunca queda vacía. Es el plus más "producción" del proyecto.
Apps Script: doGet con cache de 60s; doPost con idempotency key (doble click no duplica filas), re-validación y recálculo del total server-side contra los precios de la hoja (nunca confiar en el cliente). POST con Content-Type: text/plain para esquivar el gotcha clásico de CORS en Apps Script.
Tests con Vitest solo donde importan: lógica pura de carrito (dinero en enteros CLP, sin floats), parseo/validación del menú, y las funciones puras del Apps Script. Nada de tests decorativos de UI.
Deploy en GitHub Pages con Actions (CI: typecheck + test + build + deploy) — todo queda en un solo lugar y el pipeline es evidencia técnica visible.
Cortes deliberados documentados: sin auth/pagos/stock, endpoint público mitigado (honeypot + validación) pero asumido como limitación del stack pedido.
Lo único que no puedo hacer yo: crear el Google Sheet y deployar el Apps Script (requiere tu cuenta Google). El plan lo pone como paso 1 en paralelo — yo te escribo el Code.gs y los datos del menú listos para pegar, vos lo deployás (~10 min) y me pasás la URL /exec.

Si el plan te cierra, arranco por el Code.gs + scaffold de Astro para que puedas hacer la parte de Google mientras yo construyo el resto. ¿Ajustamos algo?

Arrancamos Ya, Haz primero gs , el gs podria tener un menu personalizado para inicializar las paginas necesarias. Todo en codigo, instalacion simple. Pego gs (pueden ser mas de uno) inicializo desde menu.
Luego el resto del plan.

Perfecto, arranco. Primero los .gs con menú de inicialización (pegar → recargar → un click), después sigo con el scaffold de Astro mientras vos hacés la parte de Google.


Creado 26 archivos, ejecutado 2 comandos, editado un archivo
+1644
-2
Ya tienes el spreadsheet abierto en tu broswer. Mi cuenta logueada, Todo inicializado desde menu.

Tests: 36/36 pasando. El astro check quedó cortado — lo corro de nuevo y en paralelo miro el spreadsheet en el browser.


Ejecutado 5 comandos, editado apps-script.test.ts, usado 3 herramientas
+2
-2
Typecheck limpio y 36/36 tests. Ahora voy al editor de Apps Script para el deploy del Web App:


Usado 9 herramientas
Editor abierto con ambos archivos pegados. Hago el deploy como Web App (Implementar → Nueva implementación):


Creado .env, ejecutado 3 comandos, usado 27 herramientas
+1
-0
Build OK (el snapshot se generó contra el endpoint real). Levanto el dev server y verifico el flujo completo en el browser:

Miniatura de página
La Pizzería del Sheet
localhost:4321 · Abierto en el navegador

Creado launch.json, usado 13 herramientas
+11
-0
🎉 Flujo E2E completo funcionando: orden enviada desde la UI, total $24.470, referencia UUID, carrito vaciado tras confirmación. Ahora el README final y dejo el repo listo para publicar:


Creado 2 archivos, ejecutado 2 comandos, editado 2 archivos
+89
-1
