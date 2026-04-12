import json
from pathlib import Path
from scipy import stats

TABLES_DIR = Path(__file__).parent / "tables"


class NormativeCalculator:
    TEST_FILES = {
        "TMT-A": "tmt_a.json",
        "TMT-B": "tmt_b.json",
        "Fluidez-FAS": "fluidez_fas.json",
        "Fluidez-PRM": "fluidez_fas.json",
        "Fluidez-Semantica": "fluidez_semantica.json",
        "TAVEC": "tavec.json",
        "Rey-Copia": "rey_copia.json",
        "Rey-Memoria": "rey_memoria.json",
    }

    PE_TO_PERCENTILE: dict[int, float] = {
        1: 0.1, 2: 0.5, 3: 2.0, 4: 4.5, 5: 8.0, 6: 12.0, 7: 17.0, 8: 25.0,
        9: 37.0, 10: 50.0, 11: 63.0, 12: 75.0, 13: 84.0, 14: 91.0, 15: 95.0,
        16: 97.0, 17: 98.5, 18: 99.5, 19: 99.9,
    }

    def __init__(self):
        self._tables: dict = {}
        self._load_tables()

    def _load_tables(self):
        for test_type, filename in self.TEST_FILES.items():
            path = TABLES_DIR / filename
            if path.exists():
                with open(path, encoding="utf-8") as f:
                    self._tables[test_type] = json.load(f)

    def calculate(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        if test_type == "MoCA":
            return self._calculate_moca(raw_score, education_years)
        if test_type in ("BDI-II", "Beck"):
            return self._calculate_bdi(raw_score)
        if test_type == "STAI":
            return self._calculate_stai(raw_score)
        if test_type == "Test-d2-R":
            return self._calculate_d2(raw_score)
        if test_type in self._tables:
            return self._calculate_from_table(test_type, raw_score, age, education_years)
        return self._calculate_simulated(test_type, raw_score, age, education_years)

    def _calculate_d2(self, indice_concentracion: float) -> dict:
        """
        Test d2-R (Brickenkamp, Zillmer & Lazo, 2012).
        CON (Índice de Concentración) = ΣTR − ΣO − 2×ΣC (0–max ~650).
        No normative table validated for Spain — orientative thresholds
        based on Brickenkamp (2012) German standardisation (adults 18–79).
        """
        con = int(indice_concentracion)
        if con >= 180:
            clasificacion = "Muy alto"
        elif con >= 140:
            clasificacion = "Alto"
        elif con >= 100:
            clasificacion = "Medio"
        elif con >= 60:
            clasificacion = "Bajo"
        else:
            clasificacion = "Muy bajo"

        return {
            "puntuacion_escalar": con,
            "percentil": None,
            "z_score": None,
            "clasificacion": clasificacion,
            "norma_aplicada": {
                "fuente": "Test d2-R — Brickenkamp, Zillmer & Lazo (2012)",
                "test": "Test-d2-R",
                "nota": "Sin tabla normativa española validada. Umbrales orientativos. Ver también TOT y VA en raw_data.",
            },
        }

    def _calculate_stai(self, puntuacion_estado: float) -> dict:
        """
        STAI — Spielberger, Gorsuch & Lushene (1970).
        Adaptación española: Buela-Casal, Guillén-Riquelme & Seisdedos Cubero (2011).
        Uses Estado score (0–60) as primary. Rasgo stored separately in raw_data.
        No NEURONORMA table — orientative cutoffs (norms vary by age/sex).
        """
        score = int(puntuacion_estado)
        if score <= 20:
            clasificacion = "Ansiedad baja"
        elif score <= 30:
            clasificacion = "Ansiedad media"
        elif score <= 44:
            clasificacion = "Ansiedad alta"
        else:
            clasificacion = "Ansiedad muy alta"

        return {
            "puntuacion_escalar": score,
            "percentil": None,
            "z_score": None,
            "clasificacion": clasificacion,
            "norma_aplicada": {
                "fuente": "STAI — Spielberger et al. (1970) / Buela-Casal et al. (2011)",
                "test": "STAI",
                "nota": "Puntuación Estado. Ver también puntuacion_rasgo en raw_data.",
            },
        }

    def _calculate_bdi(self, total: float) -> dict:
        """
        BDI-II (Beck, Steer & Brown, 1996).
        Total 0–63. No NEURONORMA table — uses clinical cutoffs.
        """
        score = int(total)
        if score <= 13:
            clasificacion = "Depresión mínima"
        elif score <= 19:
            clasificacion = "Depresión leve"
        elif score <= 28:
            clasificacion = "Depresión moderada"
        else:
            clasificacion = "Depresión grave"

        return {
            "puntuacion_escalar": score,
            "percentil": None,
            "z_score": None,
            "clasificacion": clasificacion,
            "norma_aplicada": {
                "fuente": "BDI-II — Beck, Steer & Brown (1996)",
                "test": "BDI-II",
                "punto_corte_leve": 14,
                "punto_corte_moderada": 20,
                "punto_corte_grave": 29,
            },
        }

    def _calculate_moca(self, total_bruto: float, education_years: int) -> dict:
        """
        MoCA (Montreal Cognitive Assessment) — Nasreddine et al., 2005.
        Total max = 30 points. Education adjustment: +1 if ≤12 years (capped at 30).
        Cutoffs: ≥26 Normal | 18-25 DCL | 10-17 Moderado | ≤9 Grave
        """
        edu_adjustment = 1 if education_years <= 12 else 0
        total_adjusted = min(30, int(total_bruto) + edu_adjustment)

        if total_adjusted >= 26:
            clasificacion = "Normal"
        elif total_adjusted >= 18:
            clasificacion = "Deterioro cognitivo leve"
        elif total_adjusted >= 10:
            clasificacion = "Deterioro cognitivo moderado"
        else:
            clasificacion = "Deterioro cognitivo grave"

        return {
            "puntuacion_escalar": total_adjusted,
            "percentil": None,
            "z_score": None,
            "clasificacion": clasificacion,
            "norma_aplicada": {
                "fuente": "MoCA — Nasreddine et al. (2005)",
                "test": "MoCA",
                "ajuste_educacion": edu_adjustment,
                "puntuacion_bruta": int(total_bruto),
                "puntuacion_ajustada": total_adjusted,
                "punto_corte": 26,
            },
        }

    def _calculate_from_table(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        table = self._tables[test_type]

        age_range = None
        for ar in table["age_ranges"]:
            if ar["age_min"] <= age <= ar["age_max"]:
                age_range = ar
                break
        if age_range is None:
            age_range = table["age_ranges"][0]

        edu_range = None
        for er in age_range["education_ranges"]:
            if er["education_min"] <= education_years <= er["education_max"]:
                edu_range = er
                break
        if edu_range is None:
            edu_range = age_range["education_ranges"][0]

        conv_table = edu_range["conversion_table"]

        key = str(int(raw_score))
        if key in conv_table:
            pe = conv_table[key]["pe"]
            percentil = conv_table[key]["percentil"]
        else:
            pe, percentil = self._interpolate_scores(raw_score, conv_table)

        percentil_clamped = max(0.01, min(99.99, percentil))
        z_score = round(stats.norm.ppf(percentil_clamped / 100), 2)

        return {
            "puntuacion_escalar": int(pe),
            "percentil": float(percentil),
            "z_score": z_score,
            "clasificacion": self._classify(percentil),
            "norma_aplicada": {
                "fuente": "NEURONORMA",
                "test": test_type,
                "rango_edad": f"{age_range['age_min']}-{age_range['age_max']}",
                "rango_educacion": f"{edu_range['education_min']}-{edu_range['education_max']}",
            },
        }

    def _interpolate_scores(self, raw_score: float, conversion_table: dict):
        available = sorted(int(k) for k in conversion_table.keys())
        lower_scores = [s for s in available if s <= raw_score]
        upper_scores = [s for s in available if s >= raw_score]

        if not lower_scores:
            k = str(available[0])
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]
        if not upper_scores:
            k = str(available[-1])
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]

        lower = lower_scores[-1]
        upper = upper_scores[0]

        if lower == upper:
            k = str(lower)
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]

        ratio = (raw_score - lower) / (upper - lower)
        pe_l = conversion_table[str(lower)]["pe"]
        pe_u = conversion_table[str(upper)]["pe"]
        p_l = conversion_table[str(lower)]["percentil"]
        p_u = conversion_table[str(upper)]["percentil"]

        pe = round(pe_l + ratio * (pe_u - pe_l))
        percentil = round(p_l + ratio * (p_u - p_l), 1)
        return pe, percentil

    def calculate_from_pe(self, test_type: str, pe: int) -> dict:
        """Use when the clinician provides the PE directly (e.g. WAIS-IV subtests)."""
        pe = max(1, min(19, int(pe)))
        percentil = self.PE_TO_PERCENTILE.get(pe, 50.0)
        z_score = round(stats.norm.ppf(max(0.001, min(0.999, percentil / 100))), 2)
        return {
            "puntuacion_escalar": pe,
            "percentil": percentil,
            "z_score": z_score,
            "clasificacion": self._classify(percentil),
            "norma_aplicada": {"fuente": "WAIS-IV", "test": test_type},
        }

    def _calculate_simulated(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        """No validated normative table available for this test."""
        return {
            "puntuacion_escalar": None,
            "percentil": None,
            "z_score": None,
            "clasificacion": "Sin norma validada",
            "norma_aplicada": {"fuente": "Sin tabla normativa", "test": test_type},
        }

    def _classify(self, percentil: float) -> str:
        if percentil >= 75:
            return "Superior"
        if percentil >= 25:
            return "Normal"
        if percentil >= 10:
            return "Limítrofe"
        return "Deficitario"


calculator = NormativeCalculator()
