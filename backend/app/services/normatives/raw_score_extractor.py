from typing import Any, Dict


def extract_raw_score(test_type: str, raw_data: Dict[str, Any]) -> float:
    extractors = {
        "TMT-A":             lambda d: d["tiempo_segundos"],
        "TMT-B":             lambda d: d["tiempo_segundos"],
        "TAVEC":             lambda d: sum(d[f"ensayo_{i}"] for i in range(1, 6)),
        "Fluidez-FAS":       lambda d: d["letra_f"] + d["letra_a"] + d["letra_s"],
        "Fluidez-Semantica": lambda d: float(d.get("animales", 0)),
        "Rey-Copia":         lambda d: d["puntuacion_bruta"],
        "Rey-Memoria":       lambda d: d["puntuacion_bruta"],
        "Toulouse-Pieron":   lambda d: d["productividad_neta"],
        "Torre-de-Londres":  lambda d: _torre_raw(d),
        "Stroop":            lambda d: _stroop_interference(d),
        "DIVA-5":            lambda d: d["inatención_actual"] + d["hiperactividad_actual"],
        "BRIEF-A":           lambda d: sum(d.values()),
        "WAIS-IV":           lambda d: d["CI_total"],
        "Dígitos":           lambda d: d["digitos_directos"] + d["digitos_inversos"] + d["secuencia_letras_numeros"],
        "Test-d2-R":         lambda d: d["indice_concentracion"],
        "FDT":               lambda d: d["elegir_tiempo"] + d["alternar_tiempo"],
        "BADS-Zoo":          lambda d: d["puntuacion_perfil"],
        "BADS-Llave":        lambda d: d["puntuacion_estrategia"],
        "FCSRT":             lambda d: d["total_inmediato"],
        "Perfil-Sensorial":  lambda d: sum(d.values()),
        "MoCA":              lambda d: float(d.get("total_bruto", 0)),
    }

    if test_type not in extractors:
        return float(sum(v for v in raw_data.values() if isinstance(v, (int, float))))

    return float(extractors[test_type](raw_data))


def _stroop_interference(raw_data: dict) -> float:
    """
    Índice de interferência Stroop: PC_obs - PC_esperado
    PC_esperado = (P x C) / (P + C)  (fórmula Golden, 1978)
    Valor positivo = boa inibição de resposta automática.
    """
    p = raw_data.get("palabras", 0)
    c = raw_data.get("colores", 0)
    pc = raw_data.get("interferencia", 0)
    if p + c == 0:
        return float(pc)
    pc_esperado = (p * c) / (p + c)
    return float(pc - pc_esperado)


def _torre_raw(raw_data: dict) -> float:
    from app.services.normatives.torre_calculator import TowerOfLondonCalculator
    result = TowerOfLondonCalculator.calculate(
        raw_data.get("movement_counts", []),
        raw_data.get("time_seconds", None),
    )
    return result["composite_raw_score"]
