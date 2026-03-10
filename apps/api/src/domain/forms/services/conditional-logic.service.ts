import { Injectable } from '@nestjs/common';
import {
  ConditionalLogic,
  ConditionalOperator,
} from '../dto/conditional-logic.dto';

@Injectable()
export class ConditionalLogicService {
  /**
   * Evaluate if a field should be visible/required based on conditional logic
   */
  evaluateCondition(
    conditionalLogic: ConditionalLogic,
    formResponses: Record<string, any>,
  ): boolean {
    if (
      !conditionalLogic ||
      !conditionalLogic.rules ||
      conditionalLogic.rules.length === 0
    ) {
      return true; // No conditions means always show
    }

    const results = conditionalLogic.rules.map((rule) => {
      const fieldValue = formResponses[rule.fieldId];
      return this.evaluateRule(rule.operator, fieldValue, rule.value);
    });

    // Apply logic gate (AND/OR)
    if (conditionalLogic.logic === 'OR') {
      return results.some((r) => r === true);
    } else {
      return results.every((r) => r === true);
    }
  }

  /**
   * Evaluate a single conditional rule
   */
  private evaluateRule(
    operator: ConditionalOperator,
    fieldValue: any,
    compareValue: any,
  ): boolean {
    switch (operator) {
      case ConditionalOperator.EQUALS:
        return this.compareEquals(fieldValue, compareValue);

      case ConditionalOperator.NOT_EQUALS:
        return !this.compareEquals(fieldValue, compareValue);

      case ConditionalOperator.CONTAINS:
        return this.compareContains(fieldValue, compareValue);

      case ConditionalOperator.NOT_CONTAINS:
        return !this.compareContains(fieldValue, compareValue);

      case ConditionalOperator.GREATER_THAN:
        return this.compareNumber(fieldValue, compareValue, '>');

      case ConditionalOperator.LESS_THAN:
        return this.compareNumber(fieldValue, compareValue, '<');

      case ConditionalOperator.GREATER_THAN_OR_EQUAL:
        return this.compareNumber(fieldValue, compareValue, '>=');

      case ConditionalOperator.LESS_THAN_OR_EQUAL:
        return this.compareNumber(fieldValue, compareValue, '<=');

      case ConditionalOperator.IS_EMPTY:
        return this.isEmpty(fieldValue);

      case ConditionalOperator.IS_NOT_EMPTY:
        return !this.isEmpty(fieldValue);

      default:
        return true;
    }
  }

  private compareEquals(value1: any, value2: any): boolean {
    // Handle arrays (for checkbox fields)
    if (Array.isArray(value1)) {
      return value1.includes(value2);
    }

    // Handle boolean strings
    if (typeof value1 === 'string' && typeof value2 === 'boolean') {
      return value1.toLowerCase() === value2.toString();
    }
    if (typeof value2 === 'string' && typeof value1 === 'boolean') {
      return value2.toLowerCase() === value1.toString();
    }

    // Loose equality for strings and numbers
    return String(value1).toLowerCase() === String(value2).toLowerCase();
  }

  private compareContains(value: any, searchValue: any): boolean {
    if (value === null || value === undefined) return false;

    // Handle arrays
    if (Array.isArray(value)) {
      return value.some((v) =>
        String(v).toLowerCase().includes(String(searchValue).toLowerCase()),
      );
    }

    // Handle strings
    return String(value)
      .toLowerCase()
      .includes(String(searchValue).toLowerCase());
  }

  private compareNumber(
    value1: any,
    value2: any,
    operator: '>' | '<' | '>=' | '<=',
  ): boolean {
    const num1 = Number(value1);
    const num2 = Number(value2);

    if (isNaN(num1) || isNaN(num2)) return false;

    switch (operator) {
      case '>':
        return num1 > num2;
      case '<':
        return num1 < num2;
      case '>=':
        return num1 >= num2;
      case '<=':
        return num1 <= num2;
      default:
        return false;
    }
  }

  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0)
      return true;
    return false;
  }

  /**
   * Get all fields that should be visible/required based on responses
   */
  getVisibleFields(
    fields: Array<{ id: string; conditionalLogic?: any; required: boolean }>,
    formResponses: Record<string, any>,
  ): {
    visibleFieldIds: string[];
    requiredFieldIds: string[];
    skippedFieldIds: string[];
  } {
    const visibleFieldIds: string[] = [];
    const requiredFieldIds: string[] = [];
    const skippedFieldIds: string[] = [];

    for (const field of fields) {
      if (!field.conditionalLogic) {
        // No conditions - always visible
        visibleFieldIds.push(field.id);
        if (field.required) {
          requiredFieldIds.push(field.id);
        }
        continue;
      }

      const conditionMet = this.evaluateCondition(
        field.conditionalLogic as ConditionalLogic,
        formResponses,
      );

      const action = field.conditionalLogic.rules?.[0]?.action || 'show';

      if (action === 'show' && conditionMet) {
        visibleFieldIds.push(field.id);
        if (field.required) {
          requiredFieldIds.push(field.id);
        }
      } else if (action === 'hide' && !conditionMet) {
        visibleFieldIds.push(field.id);
        if (field.required) {
          requiredFieldIds.push(field.id);
        }
      } else if (action === 'require' && conditionMet) {
        visibleFieldIds.push(field.id);
        requiredFieldIds.push(field.id);
      } else if (action === 'skip' && conditionMet) {
        skippedFieldIds.push(field.id);
      } else {
        // Condition not met for show, or met for hide
        visibleFieldIds.push(field.id);
      }
    }

    return { visibleFieldIds, requiredFieldIds, skippedFieldIds };
  }
}
