// Biblioteca de frases das Ocorrências Misteriosas. {mascote} vira o nome da instância afetada.
export type OccurrenceTag = "MISSING" | "DISOBEDIENT" | "BUSY" | "BEWITCHED" | "UNDER_INVESTIGATION";

export const OCCURRENCE_TAGS: OccurrenceTag[] = ["MISSING", "DISOBEDIENT", "BUSY", "BEWITCHED", "UNDER_INVESTIGATION"];

export const OCCURRENCE_TAG_LABEL: Record<OccurrenceTag, string> = {
  MISSING: "Desaparecido",
  DISOBEDIENT: "Desobediente",
  BUSY: "Ocupado",
  BEWITCHED: "Enfeitiçado",
  UNDER_INVESTIGATION: "Em investigação",
};

// Texto da tag exibido ao jogador no aviso.
export const OCCURRENCE_TAG_PLAYER_LABEL: Record<OccurrenceTag, string> = {
  MISSING: "Desaparecido — temporariamente indisponível",
  DISOBEDIENT: "Desobediente — temporariamente indisponível",
  BUSY: "Ocupado — temporariamente indisponível",
  BEWITCHED: "Enfeitiçado — temporariamente indisponível",
  UNDER_INVESTIGATION: "Em investigação — temporariamente indisponível",
};

export const OCCURRENCE_PHRASES: Record<OccurrenceTag, string[]> = {
  MISSING: [
    "Por algum motivo inexplicável, {mascote} deixou de obedecer aos chamados e correu em direção à mata. Desde então, ninguém conseguiu encontrá-lo.",
    "{mascote} desapareceu durante a madrugada. Nenhum dos outros mascotes parece ter percebido quando ele saiu.",
    "Algumas testemunhas viram {mascote} caminhando sozinho para longe do refúgio. Quando tentaram segui-lo, já era tarde.",
    "{mascote} parecia ouvir algo distante. Pouco depois, afastou-se sem avisar e desapareceu.",
    "Durante uma ronda, perceberam que {mascote} não estava mais no refúgio. As buscas iniciais não tiveram resultado.",
    "{mascote} ficou encarando a floresta por vários minutos antes de sair correndo. Ninguém conseguiu acompanhá-lo.",
    "Um barulho incomum foi ouvido perto do refúgio. Quando foram verificar, {mascote} havia desaparecido.",
    "{mascote} saiu silenciosamente durante a noite. Seu paradeiro continua desconhecido.",
    "Os outros mascotes ficaram inquietos pouco antes de {mascote} desaparecer. Ninguém sabe se os acontecimentos estão relacionados.",
    "{mascote} foi visto pela última vez parado diante da entrada do refúgio. Desde então, não houve notícias dele.",
  ],
  DISOBEDIENT: [
    "{mascote} começou a ignorar todos os comandos, mesmo aqueles que sempre executou sem dificuldades.",
    "Sem motivo aparente, {mascote} passou a se afastar sempre que alguém tenta se aproximar.",
    "{mascote} interrompeu suas atividades e se recusou a retornar ao treinamento.",
    "Apesar de estar saudável, {mascote} demonstra um comportamento incomum e não responde ao treinador.",
    "{mascote} parece distraído por alguma coisa que ninguém consegue identificar. Por enquanto, não aceita comandos.",
    "Durante uma atividade rotineira, {mascote} simplesmente parou de cooperar.",
    "{mascote} começou a agir de maneira imprevisível. Será necessário aguardar até que se acalme.",
    "Algo mudou no comportamento de {mascote}. Ele continua no refúgio, mas não demonstra interesse em participar das atividades.",
    "{mascote} tem evitado o contato com outros mascotes e ignorado as tentativas de aproximação.",
    "Os responsáveis pelo refúgio relataram que {mascote} não está agindo como de costume. Suas atividades foram suspensas temporariamente.",
  ],
  BUSY: [
    "{mascote} começou a se dedicar a alguma atividade desconhecida e não parece disposto a interrompê-la.",
    "Sem explicação, {mascote} se afastou das atividades habituais e parece concentrado em algo importante.",
    "{mascote} passou horas observando o mesmo lugar. Por enquanto, não demonstra interesse em participar de outras atividades.",
    "Os responsáveis encontraram {mascote} completamente distraído. Ninguém sabe o que está prendendo tanto sua atenção.",
    "{mascote} insiste em permanecer em uma área isolada do refúgio, aparentemente ocupado com alguma coisa.",
    "Desde cedo, {mascote} parece estar seguindo uma rotina diferente. Não foi possível descobrir o motivo.",
    "{mascote} se afastou temporariamente das atividades para resolver algo por conta própria.",
    "Mesmo após vários chamados, {mascote} continua concentrado em uma tarefa que ninguém consegue compreender.",
    "{mascote} parece estar esperando alguma coisa. Até lá, não demonstra vontade de sair do lugar.",
    "Uma mudança repentina na rotina de {mascote} chamou a atenção dos responsáveis. Ele ficará indisponível por algum tempo.",
  ],
  BEWITCHED: [
    "Uma sensação estranha tomou conta do refúgio pouco antes de {mascote} começar a agir de maneira incomum.",
    "{mascote} permaneceu imóvel por um longo período, como se estivesse completamente distraído por alguma coisa.",
    "Os olhos de {mascote} pareceram perder o foco por alguns instantes. Desde então, ele não reage normalmente.",
    "{mascote} começou a murmurar sons incompreensíveis durante o descanso. Seu comportamento permanece estranho.",
    "Uma mudança inexplicável foi percebida em {mascote}. Por precaução, suas atividades foram suspensas.",
    "{mascote} parece estar sob alguma influência desconhecida, embora ninguém consiga confirmar o que aconteceu.",
    "Durante alguns minutos, {mascote} não reconheceu o ambiente ao redor. Ele precisará permanecer em observação.",
    "{mascote} acordou assustado e passou a observar constantemente os cantos vazios do refúgio.",
    "Os outros mascotes parecem desconfortáveis perto de {mascote}, que continua apresentando um comportamento incomum.",
    "{mascote} começou a agir como se estivesse seguindo instruções que ninguém mais consegue ouvir.",
  ],
  UNDER_INVESTIGATION: [
    "Uma ocorrência incomum envolvendo {mascote} foi registrada. Suas atividades ficarão suspensas até que a situação seja esclarecida.",
    "Os responsáveis pelo refúgio estão tentando entender uma mudança repentina no comportamento de {mascote}.",
    "{mascote} foi afastado temporariamente após um incidente que ainda não pôde ser explicado.",
    "Um acontecimento inesperado envolvendo {mascote} chamou a atenção dos responsáveis. A situação está sendo acompanhada.",
    "Por precaução, {mascote} permanecerá indisponível enquanto algumas circunstâncias são verificadas.",
    "Algo incomum aconteceu durante as atividades de {mascote}. Ainda não existem informações suficientes para explicar o ocorrido.",
    "{mascote} apresentou sinais de inquietação fora do habitual. Os responsáveis decidiram observar seu comportamento.",
    "Uma situação desconhecida envolvendo {mascote} está sendo analisada. Novas informações poderão surgir posteriormente.",
    "Após um episódio inesperado, {mascote} foi temporariamente afastado de suas atividades.",
    "Os responsáveis notaram algo estranho em {mascote}, mas ainda não conseguiram determinar o que aconteceu.",
  ],
};

export const OCCURRENCE_RETURN_PHRASES: string[] = [
    "Depois de horas sem notícias, {mascote} finalmente retornou ao refúgio. Ele parece cansado, mas está bem e pode retomar suas atividades.",
    "{mascote} voltou inesperadamente. Apesar de tudo, parece agir como se nada tivesse acontecido.",
    "Finalmente, {mascote} está de volta! Ninguém sabe explicar onde esteve, mas seu comportamento voltou ao normal.",
    "{mascote} foi encontrado próximo ao refúgio. Ele parece um pouco confuso, mas não apresenta nenhum problema.",
    "Sem qualquer aviso, {mascote} reapareceu no refúgio. Depois de algum descanso, voltou à sua rotina habitual.",
    "O comportamento incomum de {mascote} finalmente cessou. Ele está respondendo normalmente aos comandos.",
    "{mascote} retornou em segurança. Apesar das tentativas de entender o ocorrido, ninguém conseguiu descobrir o motivo de sua ausência.",
    "Depois de um período de inquietação, {mascote} voltou a agir normalmente e já pode participar das atividades.",
    "Os responsáveis confirmaram que {mascote} está bem. A situação parece ter se resolvido por conta própria.",
    "{mascote} finalmente voltou! O que aconteceu durante esse período continua sendo um mistério, mas ele está disponível novamente.",
  ];

export const OCCURRENCE_RETURN_DEFAULT = OCCURRENCE_RETURN_PHRASES[2];

export function renderOccurrenceText(template: string, mascotName: string) {
  return template.replace(/{mascote}/g, mascotName);
}
