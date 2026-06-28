// Validação de CPF (dígitos verificadores). Aceita com ou sem máscara.
export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // rejeita sequências repetidas (000... , 111...)

  const digitoVerificador = (qtd: number): number => {
    let soma = 0
    for (let i = 0; i < qtd; i++) {
      soma += parseInt(d.charAt(i), 10) * (qtd + 1 - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digitoVerificador(9) === parseInt(d.charAt(9), 10) && digitoVerificador(10) === parseInt(d.charAt(10), 10)
}
