// Terms of use and privacy texts shown in the app: Mexico (Spanish) and USA (English).
// Drafts until a lawyer reviews them. Keep them in sync with the "SadBarz · Términos y
// privacidad" doc, and bump TERMS_VERSION when a change needs everyone to accept again.
//
// Format: paragraphs split by a blank line, "## " headings, "- " bullets, **bold**.

export const TERMS_VERSION = 1;

// Filled in before launch (see the launch checklist in the doc).
export const LEGAL = {
  owner: '[nombre legal]',
  address: '[domicilio]',
  email: '[correo de contacto]',
  courtsMx: '[ciudad, estado]',
  stateUs: '[state]',
  courtsUs: '[county, state]',
  updated: '2026-10-26',
};

export type LegalCountry = 'mx' | 'us';
export type LegalDoc = 'terms' | 'privacy';

const L = LEGAL;

const termsMx = `*Versión ${TERMS_VERSION} · última actualización: ${L.updated}*

**1. Quiénes somos.** SadBarz es una app de entrenamiento de calistenia operada por ${L.owner} ("SadBarz", "nosotros"), con domicilio en ${L.address}. Contacto: ${L.email}.

**2. Aceptación.** Al crear una cuenta o usar SadBarz aceptas estos Términos y el Aviso de privacidad. Si no estás de acuerdo, no uses la app.

**3. Edad.** Debes tener 18 años o más para crear una cuenta.

**4. Tu cuenta.** Eres responsable de la información que das, de mantener segura tu contraseña y de todo lo que pase en tu cuenta.

**5. Salud y riesgo.** SadBarz da rutinas, timers y recomendaciones de entrenamiento, no consejo médico. Consulta a un médico antes de empezar un programa de ejercicio, sobre todo si tienes una lesión o condición de salud. Detén el ejercicio si sientes dolor, mareo o falta de aire. Entrenas bajo tu propio riesgo, y SadBarz no es responsable de lesiones derivadas de tu entrenamiento, salvo en los casos en que la ley no permita limitar esa responsabilidad.

**6. Contenido que subes.** "Tu contenido" es todo lo que agregas a la app: foto de perfil, nombre, rutinas, registros, récords y notas.

- Eres el único responsable de tu contenido.
- Declaras que eres dueño de tu contenido o que tienes permiso para usarlo, y que no viola derechos de autor, marcas, derechos de imagen ni la privacidad de nadie.
- Tu foto de perfil debe ser tuya o una imagen que tengas derecho a usar. No subas fotos de otras personas sin su consentimiento.
- No subas contenido ilegal, sexual, violento, ofensivo, discriminatorio o engañoso.
- Sigues siendo dueño de tu contenido. Nos das una licencia gratuita y no exclusiva para guardarlo, mostrarlo y procesarlo solo para operar la app y darte el servicio.

**7. Indemnización.** Si alguien reclama a SadBarz por tu contenido o por cómo usas la app, tú respondes por ese reclamo y cubres los daños, gastos y honorarios razonables de abogados que cause a SadBarz.

**8. Reportes de derechos de autor.** Si crees que algún contenido en SadBarz viola tus derechos, escribe a ${L.email} con: tu nombre y datos de contacto, la obra que dices que se infringe, dónde está el contenido en la app, y una declaración de que la información es verdadera y que eres el titular o actúas en su nombre. Retiraremos o bloquearemos el contenido reportado de forma expedita y avisaremos al usuario que lo subió, quien podrá responder.

**9. Retiro de contenido y cuentas.** Podemos retirar contenido o suspender o cerrar cuentas que violen estos Términos, incluyendo las de usuarios que reiteradamente suban contenido de otros.

**10. Plan Gratis y Pro.** El plan Gratis tiene límites (por ejemplo, 5 rutinas propias). El plan Pro, cuando esté disponible, tendrá el precio, periodo de prueba y forma de cancelar que se muestren antes de pagar.

**11. Coach con inteligencia artificial.** Los planes y respuestas del coach los genera un sistema de IA y, al inicio, los revisa un entrenador. Pueden contener errores; usa tu criterio y avisa al coach si algo te causa dolor.

**12. Propiedad de SadBarz.** La app, su marca, logotipo, diseño, rutinas de ejemplo y textos son de SadBarz. No puedes copiarlos ni venderlos sin permiso.

**13. Disponibilidad.** Hacemos lo posible por que la app funcione siempre, pero puede tener fallas o pausas. Respalda lo que sea importante para ti.

**14. Cambios.** Podemos cambiar estos Términos. Si el cambio es importante, te avisaremos en la app antes de que aplique.

**15. Ley y tribunales.** Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se resolverá ante los tribunales de ${L.courtsMx}, salvo los derechos que te da la Ley Federal de Protección al Consumidor ante PROFECO.`;

const privacyMx = `*Versión ${TERMS_VERSION} · última actualización: ${L.updated}*

**Responsable.** ${L.owner}, con domicilio en ${L.address}, es responsable del tratamiento de tus datos personales en SadBarz. Contacto de privacidad: ${L.email}.

**Datos que tratamos.**

- Cuenta: nombre, correo, contraseña (guardada cifrada) o tu cuenta de Google si entras con ella.
- Perfil de entrenamiento: meta, nivel, máximos de repeticiones, skills, equipo, días y duración de entreno, fecha de inicio, edad, peso, sexo, recordatorios.
- Entrenamiento: rutinas, entrenos registrados, tiempos, puntajes, récords personales y notas.
- Foto de perfil, si decides subir una.
- Pagos, cuando exista el plan Pro: los procesa el proveedor de pagos; nosotros no guardamos los datos de tu tarjeta.

**Datos sensibles.** Las lesiones, dolores y condiciones de salud que nos indiques son datos personales sensibles. Solo los tratamos con tu consentimiento expreso, que das al marcar la casilla al entrar por primera vez, y solo para adaptar tu entrenamiento.

**Para qué los usamos (finalidades necesarias).** Crear y mantener tu cuenta; guardar y sincronizar tus datos entre dispositivos; mostrar tu perfil, estadísticas y récords; preparar rutinas y planes de entrenamiento (en Pro, con ayuda de un sistema de inteligencia artificial y la revisión de un entrenador); cobrar el plan Pro; darte soporte y cumplir obligaciones legales.

**Finalidades secundarias.** Enviarte novedades y promociones de SadBarz y mejorar la app con estadísticas generales. Si no quieres esto, escríbenos a ${L.email}; no afecta tu servicio.

**Con quién compartimos tus datos.** Con proveedores que nos dan servicio y solo los usan siguiendo nuestras instrucciones: base de datos y cuentas (Supabase), alojamiento de la app (Vercel), el proveedor del coach de IA (en Pro) y el proveedor de pagos (en Pro). Algunos están fuera de México, por ejemplo en Estados Unidos. No vendemos tus datos. Solo los entregamos a autoridades cuando la ley lo exige.

**Tus derechos (ARCO).** Puedes pedir acceso a tus datos, corregirlos, cancelarlos (borrar tu cuenta) u oponerte a su uso, y revocar tu consentimiento. Escribe a ${L.email} desde el correo de tu cuenta, con tu nombre, lo que pides y, si aplica, documentos que lo apoyen. Te responderemos en los plazos que marca la ley.

**Cuánto tiempo los guardamos.** Mientras tengas cuenta. Si la borras, eliminamos tus datos en un plazo razonable, salvo lo que debamos conservar por ley.

**Seguridad.** Tus datos viajan cifrados y en la base de datos cada usuario solo puede ver y editar los suyos.

**Cambios a este aviso.** Te avisaremos en la app de cualquier cambio importante.`;

const termsUs = `*Version ${TERMS_VERSION} · last updated: ${L.updated}*

**1. Who we are.** SadBarz is a calisthenics training app run by ${L.owner} ("SadBarz", "we"), ${L.address}. Contact: ${L.email}.

**2. Agreement.** By creating an account or using SadBarz you agree to these Terms and our Privacy Policy. If you don't agree, don't use the app.

**3. Age.** You must be 18 or older to create an account.

**4. Your account.** You are responsible for the information you give us, for keeping your password safe, and for everything that happens in your account.

**5. Health and risk.** SadBarz provides routines, timers and training suggestions, not medical advice. Talk to a doctor before starting an exercise program, especially if you have an injury or health condition. Stop if you feel pain, dizziness or shortness of breath. You train at your own risk. To the extent the law allows, SadBarz is not liable for injuries that result from your training.

**6. Your content.** "Your content" is everything you add to the app: profile photo, name, routines, logs, records and notes.

- You are solely responsible for your content.
- You confirm that you own your content or have permission to use it, and that it doesn't infringe anyone's copyright, trademark, publicity or privacy rights.
- Your profile photo must be of you, or an image you have the right to use. Don't upload photos of other people without their consent.
- Don't upload content that is illegal, sexual, violent, hateful, harassing or misleading.
- You keep ownership of your content. You give us a free, non-exclusive, worldwide license to store, display and process it only to run the app and provide the service to you.

**7. Indemnity.** You will defend and indemnify SadBarz against any claim, damages, costs and reasonable attorneys' fees arising from your content or your use of the app in breach of these Terms.

**8. Copyright complaints (DMCA).** If you believe content on SadBarz infringes your copyright, send a notice to our designated agent at ${L.email} including: your signature; the copyrighted work; where the content is in the app; your contact details; a statement that you believe in good faith the use isn't authorized; and a statement, under penalty of perjury, that the information is accurate and you are the owner or authorized to act for the owner. We remove reported content promptly. Users whose content was removed may send a counter-notice to the same address. We close the accounts of repeat infringers.

**9. Removing content and accounts.** We may remove content, or suspend or close accounts, that break these Terms.

**10. Free and Pro plans.** The Free plan has limits (for example, 5 of your own routines). The Pro plan, when available, will show its price, free trial, renewal terms and how to cancel before you pay. Pro renews automatically until you cancel, and you can cancel online at any time.

**11. AI coach.** Coach plans and answers are generated by an AI system and, at first, reviewed by a coach. They may contain mistakes; use your judgment and tell the coach if anything causes pain.

**12. Our property.** The app, the SadBarz name, logo, design, example routines and text belong to SadBarz. Don't copy or resell them without permission.

**13. No warranty; limit of liability.** The app is provided "as is". To the extent the law allows, SadBarz is not liable for indirect or consequential damages, and its total liability is limited to the amount you paid SadBarz in the 12 months before the claim (or USD 50 if you paid nothing).

**14. Changes.** We may update these Terms. For important changes we'll tell you in the app before they apply.

**15. Governing law.** These Terms are governed by the laws of the State of ${L.stateUs}, and any dispute goes to the state or federal courts in ${L.courtsUs}, except that either party may use small claims court.`;

const privacyUs = `*Version ${TERMS_VERSION} · last updated: ${L.updated}*

**Who we are.** ${L.owner}, ${L.address}, runs SadBarz. Privacy contact: ${L.email}.

**What we collect.**

- Account: name, email, password (stored hashed), or your Google account if you sign in with Google.
- Training profile: goal, level, max reps, skills, equipment, training days and session length, start date, age, weight, sex, reminders.
- Health information you choose to share: injuries, pain or conditions, used only to adapt your training and only with your consent.
- Training data: routines, logged workouts, times, scores, personal records and notes.
- Profile photo, if you add one.
- Payments, once Pro exists: handled by our payment provider; we don't store your card number.

**How we use it.** To run your account; save and sync your data across devices; show your profile, stats and records; build routines and training plans (on Pro, with an AI system and a human coach's review); bill Pro; give support; keep the app safe; and meet legal obligations. With your permission, we may send you news about SadBarz; you can opt out at any time.

**Who we share it with.** Service providers that work for us under contract and only use the data to provide their service: database and accounts (Supabase), app hosting (Vercel), the AI coach provider (Pro) and the payment provider (Pro). We share data with authorities only when the law requires it. **We don't sell your personal information, and we don't share it for targeted advertising.**

**Your choices and rights.** You can see and edit most of your data in the app. You can ask us for a copy of your data, to correct it, or to delete your account and data by writing to ${L.email} from your account email. Depending on your state, you may have more rights (for example to access, delete, correct or limit the use of sensitive data) and to appeal our decision; we honor these requests without discrimination.

**Health data.** Training and injury information may count as consumer health data in some states. We collect it only to provide the service you asked for, with your consent, and you can withdraw consent and ask us to delete it at any time.

**How long we keep it.** While you have an account. After you delete it, we delete your data within a reasonable time, except what we must keep by law.

**Security.** Data is encrypted in transit, and in our database each user can only read and change their own data. No system is perfectly secure.

**Children.** SadBarz is for people 18 and older. We don't knowingly collect data from children under 13; if we learn we have, we delete it.

**Where data is stored.** Our providers may store and process data in the United States and other countries.

**Changes.** We'll tell you in the app about important changes to this policy.`;

export const LEGAL_TEXTS: Record<LegalCountry, Record<LegalDoc, { title: string; body: string }>> = {
  mx: {
    terms: { title: 'Términos de uso', body: termsMx },
    privacy: { title: 'Aviso de privacidad', body: privacyMx },
  },
  us: {
    terms: { title: 'Terms of Use', body: termsUs },
    privacy: { title: 'Privacy Policy', body: privacyUs },
  },
};
