import { useState } from 'react'
import FormBase from './FormBase'

interface Props {
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
}

function Toggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === 1 ? 0 : 1)}
      className={`w-10 h-6 rounded-full transition-colors flex items-center ${
        value === 1 ? 'bg-[#9839D1] justify-end' : 'bg-gray-200 justify-start'
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-white shadow mx-0.5 block" />
    </button>
  )
}

function Item({
  label,
  hint,
  value,
  onChange,
  max = 1,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  max?: number
}) {
  if (max === 1) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
        <div className="flex-1 min-w-0 pr-4">
          <span className="text-sm text-[#270D38]">{label}</span>
          {hint && <span className="text-xs text-gray-400 ml-1">— {hint}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold w-6 text-right text-[#9839D1]">{value}/1</span>
          <Toggle value={value} onChange={onChange} />
        </div>
      </div>
    )
  }

  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[#270D38]">{label}</span>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {Array.from({ length: max + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                value === i
                  ? 'bg-[#9839D1] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i}
            </button>
          ))}
          <span className="text-xs text-gray-400 w-8 text-right">{value}/{max}</span>
        </div>
      </div>
    </div>
  )
}

function Domain({ title, max, current }: { title: string; max: number; current: number }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-bold text-[#9839D1] uppercase tracking-wide">{title}</h3>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
        current === max ? 'bg-green-100 text-green-700' : 'bg-purple-50 text-[#9839D1]'
      }`}>
        {current}/{max}
      </span>
    </div>
  )
}

export default function MocaForm({ mode: _mode, onSave, onSkip, saving }: Props) {
  const [trail, setTrail] = useState(0)
  const [cubo, setCubo] = useState(0)
  const [relojContorno, setRelojContorno] = useState(0)
  const [relojNumeros, setRelojNumeros] = useState(0)
  const [relojManecillas, setRelojManecillas] = useState(0)

  const [animal1, setAnimal1] = useState(0)
  const [animal2, setAnimal2] = useState(0)
  const [animal3, setAnimal3] = useState(0)

  const [digitosDir, setDigitosDir] = useState(0)
  const [digitosInv, setDigitosInv] = useState(0)
  const [vigilancia, setVigilancia] = useState(0)
  const [restaSerial, setRestaSerial] = useState(0)

  const [frase1, setFrase1] = useState(0)
  const [frase2, setFrase2] = useState(0)
  const [fluidez, setFluidez] = useState(0)

  const [abst1, setAbst1] = useState(0)
  const [abst2, setAbst2] = useState(0)

  const [rec1, setRec1] = useState(0)
  const [rec2, setRec2] = useState(0)
  const [rec3, setRec3] = useState(0)
  const [rec4, setRec4] = useState(0)
  const [rec5, setRec5] = useState(0)

  const [orFecha, setOrFecha] = useState(0)
  const [orMes, setOrMes] = useState(0)
  const [orAnio, setOrAnio] = useState(0)
  const [orDia, setOrDia] = useState(0)
  const [orLugar, setOrLugar] = useState(0)
  const [orCiudad, setOrCiudad] = useState(0)

  const visTotal = trail + cubo + relojContorno + relojNumeros + relojManecillas
  const denTotal = animal1 + animal2 + animal3
  const atenTotal = digitosDir + digitosInv + vigilancia + restaSerial
  const langTotal = frase1 + frase2 + fluidez
  const abstTotal = abst1 + abst2
  const recTotal = rec1 + rec2 + rec3 + rec4 + rec5
  const oriTotal = orFecha + orMes + orAnio + orDia + orLugar + orCiudad
  const total = visTotal + denTotal + atenTotal + langTotal + abstTotal + recTotal + oriTotal

  const totalColor = total >= 26 ? 'text-green-600' : total >= 22 ? 'text-yellow-600' : 'text-red-600'

  const raw: Record<string, unknown> = {
    visuoespacial_trail: trail,
    visuoespacial_cubo: cubo,
    visuoespacial_reloj_contorno: relojContorno,
    visuoespacial_reloj_numeros: relojNumeros,
    visuoespacial_reloj_manecillas: relojManecillas,
    denominacion_1: animal1,
    denominacion_2: animal2,
    denominacion_3: animal3,
    atencion_digitos_directos: digitosDir,
    atencion_digitos_inversos: digitosInv,
    atencion_vigilancia: vigilancia,
    atencion_resta_serial: restaSerial,
    lenguaje_frase1: frase1,
    lenguaje_frase2: frase2,
    lenguaje_fluidez: fluidez,
    abstraccion_1: abst1,
    abstraccion_2: abst2,
    recuerdo_1: rec1,
    recuerdo_2: rec2,
    recuerdo_3: rec3,
    recuerdo_4: rec4,
    recuerdo_5: rec5,
    orientacion_fecha: orFecha,
    orientacion_mes: orMes,
    orientacion_anio: orAnio,
    orientacion_dia_semana: orDia,
    orientacion_lugar: orLugar,
    orientacion_ciudad: orCiudad,
    total_bruto: total,
  }

  return (
    <FormBase
      testType="MoCA"
      description="Montreal Cognitive Assessment — Evaluación cognitiva global (30 puntos). Punto de corte ≥26 (con corrección educativa)."
      onSave={onSave}
      onSkip={onSkip}
      saving={saving}
      rawData={raw}
      isValid={true}
    >
      <div className="flex items-center justify-between bg-[#faf5ff] border border-[#ede9fe] rounded-xl px-4 py-3 -mt-1">
        <div>
          <span className="text-sm font-medium text-[#270D38]">Puntuación total</span>
          <p className="text-[11px] text-gray-400 mt-0.5">Educación ≤12 años: +1 pto (máx. 30) — se aplica automáticamente</p>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${totalColor}`}>{total}</span>
          <span className="text-base font-medium text-gray-400">/30</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="1. Visuoespacial / Ejecutivo" max={5} current={visTotal} />
        <Item label="Alternancia Trail Making" hint="Conectar 1→A→2→B→…→5→E sin errores" value={trail} onChange={setTrail} />
        <Item label="Copia del cubo" value={cubo} onChange={setCubo} />
        <Item label="Reloj — contorno" value={relojContorno} onChange={setRelojContorno} />
        <Item label="Reloj — números" value={relojNumeros} onChange={setRelojNumeros} />
        <Item label="Reloj — manecillas (11:10)" value={relojManecillas} onChange={setRelojManecillas} />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="2. Denominación" max={3} current={denTotal} />
        <Item label="León" value={animal1} onChange={setAnimal1} />
        <Item label="Rinoceronte" value={animal2} onChange={setAnimal2} />
        <Item label="Camello / Dromedario" value={animal3} onChange={setAnimal3} />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="3. Atención" max={6} current={atenTotal} />
        <Item label="Dígitos directos" hint="2-1-8-5-4" value={digitosDir} onChange={setDigitosDir} />
        <Item label="Dígitos inversos" hint="7-4-2" value={digitosInv} onChange={setDigitosInv} />
        <Item label="Vigilancia — golpeo letra A" hint="Leer lista de letras; paciente golpea con la mano al oír A" value={vigilancia} onChange={setVigilancia} />
        <Item
          label="Resta serial: 100 − 7"
          hint="Cinco sustracciones: 3pts si ≥4 correctas; 2pts si 2–3; 1pt si 1; 0pts si ninguna"
          value={restaSerial}
          onChange={setRestaSerial}
          max={3}
        />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="4. Lenguaje" max={3} current={langTotal} />
        <Item label="Repetición frase 1" hint="«El gato se escondía bajo el sofá cuando los perros entraban en la sala»" value={frase1} onChange={setFrase1} />
        <Item label="Repetición frase 2" hint="«No sé si fue Juan quien me lo dijo, pero me lo contaron ayer»" value={frase2} onChange={setFrase2} />
        <Item label="Fluidez fonológica — letra F" hint="≥11 palabras en 60 seg (excluir nombres propios y variantes)" value={fluidez} onChange={setFluidez} />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="5. Abstracción" max={2} current={abstTotal} />
        <Item label="Tren / bicicleta" hint="Respuesta: medios de transporte (o similar)" value={abst1} onChange={setAbst1} />
        <Item label="Reloj / regla" hint="Respuesta: instrumentos de medición" value={abst2} onChange={setAbst2} />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="6. Recuerdo diferido" max={5} current={recTotal} />
        <p className="text-[11px] text-gray-400 mb-3">
          Palabras presentadas al inicio: <strong className="text-[#270D38]">CARA · SEDA · IGLESIA · CLAVEL · ROJO</strong>
        </p>
        <Item label="Cara" value={rec1} onChange={setRec1} />
        <Item label="Seda" value={rec2} onChange={setRec2} />
        <Item label="Iglesia" value={rec3} onChange={setRec3} />
        <Item label="Clavel" value={rec4} onChange={setRec4} />
        <Item label="Rojo" value={rec5} onChange={setRec5} />
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <Domain title="7. Orientación" max={6} current={oriTotal} />
        <Item label="Fecha (día del mes)" value={orFecha} onChange={setOrFecha} />
        <Item label="Mes" value={orMes} onChange={setOrMes} />
        <Item label="Año" value={orAnio} onChange={setOrAnio} />
        <Item label="Día de la semana" value={orDia} onChange={setOrDia} />
        <Item label="Lugar (tipo de lugar)" value={orLugar} onChange={setOrLugar} />
        <Item label="Ciudad" value={orCiudad} onChange={setOrCiudad} />
      </div>
    </FormBase>
  )
}