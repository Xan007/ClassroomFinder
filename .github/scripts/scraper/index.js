const core = require('@actions/core');
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

(async () => {
  const usuario = process.env.SIAU_USR;
  const contrasena = process.env.SIAU_PWD;
  const baseUrl = process.env.SIAU_URL;

  let isLoggedIn = false;
  let page = null;
  let browser = null;

  const scrapingQueue = [];

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Bloquear recursos innecesarios
    await page.route('**/*', route => {
      const blocked = ['image', 'stylesheet', 'font', 'media'];
      if (blocked.includes(route.request().resourceType())) return route.abort();
      return route.continue();
    });

    // Login
    await page.goto(`${baseUrl}/ORION/Login`);
    await page.fill('#usr', usuario);
    await page.fill('#pwd', contrasena);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.click('//*[@id="Submit"]'),
    ]);

    if (!page.url().includes('/Home')) {
      throw new Error(`Login fallido: redireccionó a ${page.url()}`);
    }

    isLoggedIn = true;
    core.info('✅ Login exitoso');

    // Navegar a HorarioGeneral
    await page.goto(`${baseUrl}/ORION/HorarioGeneral`);
    await page.waitForSelector('select#facultad');

    const facultades = await page.$$eval('select#facultad > option', options =>
      options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
    );

    for (const facultad of facultades) {
      await page.selectOption('select#facultad', facultad.value);
      const facultadCode = facultad.value;

      const programas = await page.$$eval('select#programa1 > option', options =>
        options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
      );

      for (const programa of programas) {
        const [pensumCode, duracionSemestres] = programa.value.split(' ');
        const programaLabel = programa.label;

        for (let semestre = 1; semestre <= parseInt(duracionSemestres, 10); semestre++) {
          const url = `${baseUrl}/ORION/Ajax2?value=HorarioGeneral&content=${facultadCode},${pensumCode},${duracionSemestres},${semestre}`;

          scrapingQueue.push({
            url: url,
            facultad: facultad.label,
            facultadCode: facultadCode,
            programa: programaLabel,
            pensumCode: pensumCode,
            duracion: duracionSemestres
          });
        }
      }
    }

    core.info(`🔄 Total de URLs construidas: ${scrapingQueue.length}`);

    await page.context().clearCookies();

    const datosFinales = [];
    for (const entry of scrapingQueue) {
      core.info(`✅ Extraído: ${entry.facultad} > ${entry.programa} > Semestre ${entry.duracion}`);

      page.goto(entry.url);
    }

    core.info(`🎉 Se extrajeron ${datosFinales.length} entradas.`);
    console.log(JSON.stringify(datosFinales, null, 2));

  } catch (error) {
    core.setFailed(`❌ Error en el scraping: ${error.message}`);
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.goto(`${baseUrl}/ORION/Logout`, { timeout: 3000 });
        core.info('🔒 Logout exitoso');
      } catch (_) {
        core.warning('⚠️ No se pudo hacer logout correctamente.');
      }
    }

    if (browser) await browser.close();
  }
})();
