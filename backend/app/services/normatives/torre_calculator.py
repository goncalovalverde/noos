from typing import List, Optional

MINIMUM_MOVEMENTS = {1: 4, 2: 4, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6, 9: 7, 10: 7}


class TowerOfLondonCalculator:
    @staticmethod
    def calculate(movement_counts: List[int], time_seconds: Optional[List[int]] = None) -> dict:
        if time_seconds is None:
            time_seconds = [0] * 10

        item_results = []
        total_perfect_solutions = 0
        total_movement_rating = 0
        total_time_seconds = sum(time_seconds)

        for item_num in range(1, 11):
            minimum = MINIMUM_MOVEMENTS[item_num]
            count = movement_counts[item_num - 1]
            time = time_seconds[item_num - 1]
            movement_rating = count - minimum
            is_perfect = movement_rating == 0
            item_results.append({
                "item": item_num,
                "movements_count": count,
                "minimum_movements": minimum,
                "movement_rating": movement_rating,
                "perfect": is_perfect,
                "time_seconds": time,
            })
            if is_perfect:
                total_perfect_solutions += 1
            total_movement_rating += movement_rating

        avg_time = total_time_seconds / 10 if total_time_seconds > 0 else 0
        if avg_time < 20:
            execution_efficiency = 0.95
        elif avg_time > 120:
            execution_efficiency = 0.90
        else:
            execution_efficiency = 0.95 + (0.05 * (1 - abs(avg_time - 50) / 70))

        base_score = float(total_movement_rating)
        if total_time_seconds > 0:
            if total_time_seconds < 300:
                time_penalty = base_score * 0.20
            elif total_time_seconds > 1000:
                time_penalty = base_score * 0.40
            else:
                deviation = abs(total_time_seconds - 650) / 650
                time_penalty = base_score * min(0.05 * deviation, 0.05)
        else:
            time_penalty = 0.0

        composite_raw_score = base_score + time_penalty

        return {
            "item_results": item_results,
            "total_perfect_solutions": total_perfect_solutions,
            "total_movement_rating": total_movement_rating,
            "total_time_seconds": total_time_seconds,
            "execution_efficiency": execution_efficiency,
            "composite_raw_score": composite_raw_score,
            "valid": True,
            "errors": [],
        }
