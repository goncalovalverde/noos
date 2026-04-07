import pytest
from app.services.normatives.calculator import NormativeCalculator
from app.services.normatives.raw_score_extractor import extract_raw_score

calculator = NormativeCalculator()

class TestClassification:
    def test_superior(self):
        assert calculator._classify(80) == "Superior"
    def test_normal_high(self):
        assert calculator._classify(50) == "Normal"
    def test_normal_low(self):
        assert calculator._classify(25) == "Normal"
    def test_limitrofe(self):
        assert calculator._classify(15) == "Limítrofe"
    def test_deficitario(self):
        assert calculator._classify(5) == "Deficitario"
    def test_boundary_75(self):
        assert calculator._classify(75) == "Superior"
    def test_boundary_25(self):
        assert calculator._classify(25) == "Normal"
    def test_boundary_10(self):
        assert calculator._classify(10) == "Limítrofe"

class TestInterpolation:
    def test_exact_match(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(30, table)
        assert pe == 16
        assert perc == 93.2

    def test_interpolates_midpoint(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(45, table)
        assert pe == 14  # midpoint between 16 and 12
        assert abs(perc - 84.1) < 1.0  # midpoint between 93.2 and 75.0

    def test_below_minimum_clamps_to_first(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(10, table)
        assert pe == 16
        assert perc == 93.2

    def test_above_maximum_clamps_to_last(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(100, table)
        assert pe == 12
        assert perc == 75.0

class TestTmtACalculation:
    def test_returns_dict_with_required_keys(self):
        result = calculator.calculate("TMT-A", 60, age=65, education_years=12)
        assert "puntuacion_escalar" in result
        assert "percentil" in result
        assert "z_score" in result
        assert "clasificacion" in result
        assert "norma_aplicada" in result

    def test_exact_score_in_table(self):
        # Score 55 for age=65, edu=8-12 -> PE=11, percentil=63
        result = calculator.calculate("TMT-A", 55, age=65, education_years=10)
        assert result["puntuacion_escalar"] == 11
        assert result["percentil"] == 63.0

    def test_norma_aplicada_fuente(self):
        result = calculator.calculate("TMT-A", 60, age=65, education_years=12)
        assert result["norma_aplicada"]["fuente"] == "NEURONORMA"

    def test_age_range_selection_young(self):
        result = calculator.calculate("TMT-A", 45, age=55, education_years=12)
        assert result["norma_aplicada"]["rango_edad"] == "50-64"

    def test_age_range_selection_old(self):
        result = calculator.calculate("TMT-A", 45, age=70, education_years=12)
        assert result["norma_aplicada"]["rango_edad"] == "65-100"

    def test_pe_within_valid_range(self):
        result = calculator.calculate("TMT-A", 90, age=65, education_years=8)
        assert 1 <= result["puntuacion_escalar"] <= 19

    def test_percentil_within_valid_range(self):
        result = calculator.calculate("TMT-A", 90, age=65, education_years=8)
        assert 0 <= result["percentil"] <= 100

class TestFluidezFasCalculation:
    def test_returns_correct_structure(self):
        result = calculator.calculate("Fluidez-FAS", 35, age=60, education_years=10)
        assert result["puntuacion_escalar"] == 10
        assert result["percentil"] == 50.0

    def test_interpolation_between_scores(self):
        result = calculator.calculate("Fluidez-FAS", 39, age=60, education_years=10)
        assert result["puntuacion_escalar"] > 10  # between 35 and 43

class TestTavecCalculation:
    def test_high_score_superior(self):
        result = calculator.calculate("TAVEC", 55, age=55, education_years=12)
        assert result["clasificacion"] == "Superior"

    def test_low_score_deficitario(self):
        result = calculator.calculate("TAVEC", 20, age=55, education_years=5)
        assert result["clasificacion"] in ("Deficitario", "Limítrofe")

class TestSimulatedCalculation:
    def test_unknown_test_uses_simulation(self):
        result = calculator.calculate("WAIS-IV", 100, age=65, education_years=12)
        assert result["norma_aplicada"]["fuente"] == "Simulado"
        assert "puntuacion_escalar" in result

    def test_simulation_pe_in_range(self):
        result = calculator.calculate("Dígitos", 15, age=65, education_years=8)
        assert 1 <= result["puntuacion_escalar"] <= 19

class TestRawScoreExtractor:
    def test_tmt_a(self):
        assert extract_raw_score("TMT-A", {"tiempo_segundos": 45}) == 45

    def test_tmt_b(self):
        assert extract_raw_score("TMT-B", {"tiempo_segundos": 120}) == 120

    def test_tavec(self):
        raw = {"ensayo_1": 8, "ensayo_2": 10, "ensayo_3": 12, "ensayo_4": 13, "ensayo_5": 14,
               "lista_b": 5, "recuerdo_inmediato": 10, "recuerdo_demorado": 9,
               "reconocimiento_aciertos": 15, "reconocimiento_errores": 1}
        assert extract_raw_score("TAVEC", raw) == 57  # 8+10+12+13+14

    def test_fluidez_fas(self):
        assert extract_raw_score("Fluidez-FAS", {"letra_f": 12, "letra_a": 10, "letra_s": 11}) == 33

    def test_fluidez_semantica(self):
        assert extract_raw_score("Fluidez-Semántica", {"animales": 20, "frutas": 15, "categoria_libre": 18}) == 53

    def test_wais_iv(self):
        assert extract_raw_score("WAIS-IV", {"CI_total": 110, "comprension_verbal": 105}) == 110

    def test_brief_a(self):
        raw = {"inhibicion": 5, "flexibilidad": 4, "control_emocional": 6,
               "automonitoreo": 3, "iniciativa": 5, "memoria_trabajo": 4,
               "planificacion": 6, "organizacion": 3, "automonitoreo_tarea": 4}
        assert extract_raw_score("BRIEF-A", raw) == 40

    def test_digitos(self):
        assert extract_raw_score("Dígitos", {"digitos_directos": 7, "digitos_inversos": 5, "secuencia_letras_numeros": 6}) == 18

    def test_toulouse(self):
        assert extract_raw_score("Toulouse-Piéron", {"aciertos": 100, "errores": 5, "omisiones": 3,
                                                      "productividad_bruta": 103, "productividad_neta": 95}) == 95

    def test_rey_copia(self):
        assert extract_raw_score("Rey-Copia", {"puntuacion_bruta": 32}) == 32

    def test_unknown_key_raises(self):
        with pytest.raises(KeyError):
            extract_raw_score("TMT-A", {"wrong_key": 45})

class TestTorreCalculator:
    def test_basic_calculation(self):
        from app.services.normatives.torre_calculator import TowerOfLondonCalculator
        movements = [4, 4, 5, 5, 5, 6, 6, 6, 7, 7]
        times = [30, 35, 40, 45, 50, 60, 55, 70, 65, 80]
        result = TowerOfLondonCalculator.calculate(movements, times)
        assert result["valid"] is True
        assert result["total_perfect_solutions"] == 10  # all at minimum
        assert result["composite_raw_score"] >= 0

    def test_non_perfect_solutions(self):
        from app.services.normatives.torre_calculator import TowerOfLondonCalculator
        movements = [5, 6, 7, 6, 7, 8, 8, 9, 9, 10]  # all above minimum
        times = [30]*10
        result = TowerOfLondonCalculator.calculate(movements, times)
        assert result["total_perfect_solutions"] == 0
        assert result["total_movement_rating"] > 0

class TestAPIIntegration:
    def test_post_test_calculates_scores(self, client, neuro_headers, sample_patient):
        res = client.post("/api/tests/", json={
            "patient_id": sample_patient.id,
            "test_type": "TMT-A",
            "raw_data": {"tiempo_segundos": 60}
        }, headers=neuro_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["calculated_scores"] is not None
        assert data["calculated_scores"]["puntuacion_escalar"] is not None

    def test_post_tavec_calculates_scores(self, client, neuro_headers, sample_patient):
        res = client.post("/api/tests/", json={
            "patient_id": sample_patient.id,
            "test_type": "TAVEC",
            "raw_data": {
                "ensayo_1": 8, "ensayo_2": 10, "ensayo_3": 12,
                "ensayo_4": 13, "ensayo_5": 14, "lista_b": 5,
                "recuerdo_inmediato": 10, "recuerdo_demorado": 9,
                "reconocimiento_aciertos": 15, "reconocimiento_errores": 1
            }
        }, headers=neuro_headers)
        assert res.status_code == 201
        assert res.json()["calculated_scores"]["puntuacion_escalar"] is not None
