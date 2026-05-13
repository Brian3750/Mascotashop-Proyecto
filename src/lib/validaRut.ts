export const validarRutChileno = (rutCompleto: string): boolean => {
  // 1. Limpiar el RUT de puntos, guiones y espacios, y pasarlo a mayúsculas
  const rutLimpio = rutCompleto.replace(/[^0-9kK]/g, '').toUpperCase();

  // Mínimo de caracteres para un RUT válido (ej. 7.123.456-7 -> 8 caracteres sin formato)
  if (rutLimpio.length < 8) return false;

  // 2. Separar el cuerpo (números) del dígito verificador (DV)
  const cuerpo = rutLimpio.slice(0, -1);
  const dvEntregado = rutLimpio.slice(-1);

  // 3. Calcular el Dígito Verificador usando el algoritmo Módulo 11
  let suma = 0;
  let multiplicador = 2;

  // Recorrer el cuerpo de derecha a izquierda
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperadoNum = 11 - resto;

  // Traducir el resultado al DV correspondiente
  let dvEsperado = "";
  if (dvEsperadoNum === 11) {
    dvEsperado = "0";
  } else if (dvEsperadoNum === 10) {
    dvEsperado = "K";
  } else {
    dvEsperado = dvEsperadoNum.toString();
  }

  // 4. Comparar el DV calculado con el que ingresó el usuario
  return dvEntregado === dvEsperado;
};