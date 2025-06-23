const core = require('@actions/core');
const { chromium } = require('playwright');

require('dotenv').config();

(async () => {
  const usuario = process.env.SIAU_USR;
  const contrasena = process.env.SIAU_PWD;
  const baseUrl = process.env.SIAU_URL;

  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/ORION/Login`);
    await page.fill('#usr', usuario);
    await page.fill('#pwd', contrasena);
    await page.click('//*[@id="Submit"]');

    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();

    if (!currentUrl.includes('/Home')) {
      throw new Error(`Login fallido: redireccionó a ${currentUrl}`);
    }

    core.info('✅ Login exitoso');
    await page.goto(`${baseUrl}/ORION/HorarioGeneral`);

    const facultades = await page.$$eval('select#facultad > option', options =>
      options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
    );

    for (const facultad of facultades) {
      await page.selectOption('select#facultad', facultad.value);
      await page.waitForTimeout(800);

      const programas = await page.$$eval('select#programa1 > option', options =>
        options.map(o => ({ value: o.value, label: o.textContent.trim() })).filter(o => o.value !== '0')
      );

      for (const programa of programas) {
        await page.selectOption('select#programa1', programa.value);
        await page.waitForTimeout(800);

        const numeroSemestres = programa.value.split('_')[1] || 'N/A';

        core.info(`📚 ${facultad.label} > ${programa.label} > ${numeroSemestres} Semestres`);

        /* for (let semestre = 1; semestre <= Number(numeroSemestres); semestre++) {
          await page.selectOption('select#semestre', semestre.toString());
          await page.waitForTimeout(300);

          core.info(`📚 ${facultad.label} > ${programa.label} > Semestre ${semestre} de ${numeroSemestres}`);
        }*/
      }
    }

    await browser.close();
  } catch (error) {
    core.setFailed(`❌ Error en el scraping: ${error.message}`);
  }
})();
