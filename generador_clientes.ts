import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const firstNames = [
  'Sofía', 'Mateo', 'Valentina', 'Benjamín', 'Isabella', 'Matías', 'Camila', 'Agustín', 'Florencia', 'Lucas',
  'Victoria', 'Thiago', 'Santiago', 'Martina', 'Emilia', 'Joaquín', 'Catalina', 'Diego', 'Julieta', 'Nicolás',
  'Mía', 'Bruno', 'Lucía', 'Maximiliano', 'Abril', 'Gonzalo', 'Simón', 'Antonella', 'Martín',
  'Isidora', 'Tomás', 'Paula', 'Emiliano', 'Ana', 'Federico', 'Noelia', 'Andrés', 'Renata', 'Iván'
];

const lastNames = [
  'González', 'Rodríguez', 'López', 'Martínez', 'Pérez', 'García', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
  'Rivera', 'Vargas', 'Jiménez', 'Rojas', 'Molina', 'Suárez', 'Vega', 'Castillo', 'Ortiz', 'Méndez',
  'Espinoza', 'Cruz', 'Díaz', 'Romero', 'Muñoz', 'Silva', 'Páez', 'Navarro', 'Arias', 'Figueroa'
];

const segments = ['Campeones', 'Leales', 'En Riesgo', 'Perdidos'];
const segmentWeights = [10, 25, 20, 45];

function chooseWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let value = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    value -= weights[i];
    if (value <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

const fixedProfiles = [
  {
    id: '7135797d-99b9-4012-8bc3-8d0ae461d001',
    firstName: 'Iván',
    lastName: 'Jiménez',
    puntos: 626,
    segmento: 'Perdidos'
  },
  {
    id: 'd5e10331-fefd-430c-b1b6-a4e90fffcb43',
    firstName: 'Martina',
    lastName: 'Silva',
    puntos: 309,
    segmento: 'Perdidos'
  },
  {
    id: '0d644bdd-fc17-40df-b1d3-75b640583ff1',
    firstName: 'Florencia',
    lastName: 'Rojas',
    puntos: 1041,
    segmento: 'Perdidos'
  }
];

const profileRows: string[] = fixedProfiles.map(profile =>
  `('${profile.id}', '${profile.firstName}', '${profile.lastName}', ${profile.puntos}, '${profile.segmento}')`
);

const authRows: string[] = fixedProfiles.map((profile, index) =>
  `('${profile.id}', 'user_${index + 1}@loyaldata.local', 'fakesecretpassword', now(), now(), now(), 'authenticated', 'authenticated')`
);

const ids = new Set(fixedProfiles.map(profile => profile.id));
for (let index = fixedProfiles.length; index < 500; index += 1) {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const puntos = Math.floor(Math.random() * 1201);
  const segmento = chooseWeighted(segments, segmentWeights);
  let id = randomUUID();
  while (ids.has(id)) {
    id = randomUUID();
  }
  ids.add(id);

  profileRows.push(`('${id}', '${firstName}', '${lastName}', ${puntos}, '${segmento}')`);
  authRows.push(`('${id}', 'user_${index + 1}@loyaldata.local', 'fakesecretpassword', now(), now(), now(), 'authenticated', 'authenticated')`);
}

const profileSql = `INSERT INTO perfiles (id, nombres, apellidos, puntos_acumulados, segmento_rfm) VALUES\n${profileRows.join(',\n')}\nON CONFLICT (id) DO UPDATE SET\n  nombres = EXCLUDED.nombres,\n  apellidos = EXCLUDED.apellidos,\n  puntos_acumulados = EXCLUDED.puntos_acumulados,\n  segmento_rfm = EXCLUDED.segmento_rfm;\n`;

const authSql = `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud) VALUES\n${authRows.join(',\n')}\nON CONFLICT (id) DO NOTHING;\n`;

const sqlCombined = `-- =========================================================================\n-- PASO 1: INSERTAR USUARIOS EN auth.users\n-- =========================================================================\n${authSql}\n-- =========================================================================\n-- PASO 2: INSERTAR PERFILES EN perfiles\n-- =========================================================================\n${profileSql}`;

const insertClientesPath = join(process.cwd(), 'insert_clientes.sql');
const combinedPath = join(process.cwd(), 'insert_clientes_with_auth.sql');
writeFileSync(insertClientesPath, profileSql, 'utf8');
writeFileSync(combinedPath, sqlCombined, 'utf8');
console.log(`Archivo generado: ${insertClientesPath} (${profileRows.length} perfiles)`);
console.log(`Archivo generado: ${combinedPath} (usuarios + perfiles)`);
