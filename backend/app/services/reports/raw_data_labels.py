"""
Human-readable labels for raw_data fields per test type.
Returns list of (label, value_str) tuples for report display.
"""
from typing import Any, Dict, List, Tuple


def _v(val: Any, unit: str = '') -> str:
    if val is None or val == '':
        return '—'
    if isinstance(val, float) and val == int(val):
        val = int(val)
    return f"{val}{' ' + unit if unit else ''}"


def format_raw_data(test_type: str, raw: Dict[str, Any]) -> List[Tuple[str, str]]:
    """Return list of (label, value) pairs for the given test's raw data."""
    if not raw:
        return []

    t = test_type

    if t in ('TMT-A', 'TMT-B'):
        rows = [('Tiempo de ejecución', _v(raw.get('tiempo_segundos'), 'seg'))]
        if raw.get('errores') not in (None, '', 0):
            rows.append(('Errores', _v(raw.get('errores'))))
        return rows

    if t == 'TAVEC':
        rows = []
        ensayos = [raw.get(f'ensayo_{i}') for i in range(1, 6)]
        total_a = sum(int(e) for e in ensayos if e not in (None, ''))
        rows.append(('Ensayo 1', _v(raw.get('ensayo_1'))))
        rows.append(('Ensayo 2', _v(raw.get('ensayo_2'))))
        rows.append(('Ensayo 3', _v(raw.get('ensayo_3'))))
        rows.append(('Ensayo 4', _v(raw.get('ensayo_4'))))
        rows.append(('Ensayo 5', _v(raw.get('ensayo_5'))))
        rows.append(('Total A1–A5', str(total_a)))
        rows.append(('Lista B (interferencia)', _v(raw.get('lista_b'))))
        rows.append(('Recuerdo inmediato', _v(raw.get('recuerdo_inmediato'))))
        rows.append(('Recuerdo demorado', _v(raw.get('recuerdo_demorado'))))
        rows.append(('Reconocimiento aciertos', _v(raw.get('reconocimiento_aciertos'))))
        rows.append(('Reconocimiento errores', _v(raw.get('reconocimiento_errores'))))
        if raw.get('intrusiones_total') not in (None, '', 0):
            rows.append(('Intrusiones totales', _v(raw.get('intrusiones_total'))))
        if raw.get('perseveraciones_total') not in (None, '', 0):
            rows.append(('Perseveraciones totales', _v(raw.get('perseveraciones_total'))))
        return rows

    if t in ('Fluidez-FAS', 'FAS-Verbal'):
        f = raw.get('letra_f', 0) or 0
        a = raw.get('letra_a', 0) or 0
        s = raw.get('letra_s', 0) or 0
        rows = [
            ('Letra F (60 seg)', _v(f, 'palabras')),
            ('Letra A (60 seg)', _v(a, 'palabras')),
            ('Letra S (60 seg)', _v(s, 'palabras')),
            ('Total FAS', str(int(f) + int(a) + int(s))),
        ]
        if raw.get('intrusiones') not in (None, '', 0):
            rows.append(('Intrusiones', _v(raw.get('intrusiones'))))
        if raw.get('perseveraciones') not in (None, '', 0):
            rows.append(('Perseveraciones', _v(raw.get('perseveraciones'))))
        return rows

    if t == 'Rey-Copia':
        rows = [('Puntuación copia', _v(raw.get('puntuacion_bruta'), '/ 36'))]
        if raw.get('tiempo_segundos') not in (None, ''):
            rows.append(('Tiempo de ejecución', _v(raw.get('tiempo_segundos'), 'seg')))
        if raw.get('estrategia') not in (None, ''):
            rows.append(('Estrategia de copia', str(raw.get('estrategia'))))
        return rows

    if t == 'Rey-Memoria':
        rows = [('Puntuación memoria', _v(raw.get('puntuacion_bruta'), '/ 36'))]
        if raw.get('tiempo_demora_minutos') not in (None, ''):
            rows.append(('Demora', _v(raw.get('tiempo_demora_minutos'), 'min')))
        if raw.get('estrategia') not in (None, ''):
            rows.append(('Estrategia', str(raw.get('estrategia'))))
        return rows

    if t == 'Dígitos-Directos':
        return [
            ('Span máximo directo', _v(raw.get('span_maximo'))),
            ('Total aciertos', _v(raw.get('total_aciertos'))),
        ]

    if t == 'Dígitos-Inversos':
        return [
            ('Span máximo inverso', _v(raw.get('span_maximo'))),
            ('Total aciertos', _v(raw.get('total_aciertos'))),
        ]

    if t == 'Letras-Números':
        return [
            ('Span máximo', _v(raw.get('span_maximo'))),
            ('Total aciertos', _v(raw.get('total_aciertos'))),
        ]

    if t in ('Aritmética', 'Semejanzas', 'Vocabulario', 'Matrices', 'Cubos',
             'Clave-Números', 'Búsqueda-Símbolos'):
        label_map = {
            'Aritmética': ('Puntuación total', '/ 22'),
            'Semejanzas': ('Puntuación total', '/ 36'),
            'Vocabulario': ('Puntuación total', '/ 80'),
            'Matrices': ('Puntuación total', '/ 26'),
            'Cubos': ('Puntuación total', '/ 68'),
            'Clave-Números': ('Elementos completados (90 seg)', '/ 133'),
            'Búsqueda-Símbolos': ('Aciertos (120 seg)', '/ 60'),
        }
        lbl, max_lbl = label_map.get(t, ('Puntuación bruta', ''))
        rows = [(lbl, _v(raw.get('puntuacion_bruta'), max_lbl))]
        if raw.get('errores') not in (None, '', 0):
            rows.append(('Errores', _v(raw.get('errores'))))
        if raw.get('tiempo_total') not in (None, ''):
            rows.append(('Tiempo total', _v(raw.get('tiempo_total'), 'seg')))
        return rows

    if t == 'Torre-Londres':
        counts = raw.get('movement_counts', [])
        times = raw.get('time_seconds', [])
        rows = []
        minimums = {1: 4, 2: 4, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6, 9: 7, 10: 7}
        for i, c in enumerate(counts, 1):
            mn = minimums.get(i, '?')
            t_val = times[i-1] if times and i <= len(times) else None
            t_str = f" ({t_val}s)" if t_val else ''
            rows.append((f'Problema {i} (mín {mn})', f"{c} mov{t_str}"))
        if counts:
            total_extra = sum(max(0, int(c) - minimums.get(i+1, 0)) for i, c in enumerate(counts))
            rows.append(('Penalización total', f"{total_extra} movimientos extra"))
        return rows

    if t == 'Stroop':
        p = raw.get('palabras', 0) or 0
        c = raw.get('colores', 0) or 0
        pc = raw.get('interferencia', 0) or 0
        rows = [
            ('Palabras — P', _v(p, 'correctas')),
            ('Colores — C', _v(c, 'correctas')),
            ('Color-Palabra — PC', _v(pc, 'correctas')),
        ]
        # Interference index
        denom = int(p) + int(c)
        if denom > 0:
            idx = int(pc) - (int(p) * int(c)) / denom
            rows.append(('Índice de interferencia', f"{idx:.2f}"))
        if raw.get('errores_palabras') not in (None, '', 0):
            rows.append(('Errores P', _v(raw.get('errores_palabras'))))
        if raw.get('errores_colores') not in (None, '', 0):
            rows.append(('Errores C', _v(raw.get('errores_colores'))))
        if raw.get('errores_interferencia') not in (None, '', 0):
            rows.append(('Errores PC', _v(raw.get('errores_interferencia'))))
        return rows

    # Generic fallback: show all non-zero fields
    rows = []
    for key, val in raw.items():
        if val not in (None, '', 0, [], {}):
            label = key.replace('_', ' ').title()
            rows.append((label, str(val)))
    return rows
