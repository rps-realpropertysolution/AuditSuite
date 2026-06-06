export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          acao_corretiva: string | null
          answer_id: string | null
          created_at: string
          created_by: string | null
          data_conclusao: string | null
          descricao: string | null
          empreendimento_id: string
          evidencia_conclusao: string | null
          id: string
          observacoes: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["criticidade"]
          responsavel: string | null
          status: Database["public"]["Enums"]["action_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          acao_corretiva?: string | null
          answer_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          empreendimento_id: string
          evidencia_conclusao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["criticidade"]
          responsavel?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string | null
          answer_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          empreendimento_id?: string
          evidencia_conclusao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["criticidade"]
          responsavel?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "audit_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_answers: {
        Row: {
          answered_by: string | null
          comentario: string | null
          created_at: string
          data_conclusao: string | null
          empreendimento_id: string
          id: string
          item_id: string
          prazo: string | null
          report_id: string
          responsavel: string | null
          status: Database["public"]["Enums"]["answer_status"]
          updated_at: string
        }
        Insert: {
          answered_by?: string | null
          comentario?: string | null
          created_at?: string
          data_conclusao?: string | null
          empreendimento_id: string
          id?: string
          item_id: string
          prazo?: string | null
          report_id: string
          responsavel?: string | null
          status?: Database["public"]["Enums"]["answer_status"]
          updated_at?: string
        }
        Update: {
          answered_by?: string | null
          comentario?: string | null
          created_at?: string
          data_conclusao?: string | null
          empreendimento_id?: string
          id?: string
          item_id?: string
          prazo?: string | null
          report_id?: string
          responsavel?: string | null
          status?: Database["public"]["Enums"]["answer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "audit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_answers_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "audit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_categories: {
        Row: {
          codigo: string
          created_at: string
          descricao: string | null
          id: number
          nome: string
          ordem: number
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: number
          nome: string
          ordem?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: number
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      audit_items: {
        Row: {
          ativo: boolean
          category_id: number
          codigo: string
          created_at: string
          criticidade: Database["public"]["Enums"]["criticidade"]
          descricao: string | null
          evidencia_obrigatoria: boolean
          id: string
          ordem: number
          pergunta: string
          sla_dias: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          category_id: number
          codigo: string
          created_at?: string
          criticidade?: Database["public"]["Enums"]["criticidade"]
          descricao?: string | null
          evidencia_obrigatoria?: boolean
          id?: string
          ordem?: number
          pergunta: string
          sla_dias?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          category_id?: number
          codigo?: string
          created_at?: string
          criticidade?: Database["public"]["Enums"]["criticidade"]
          descricao?: string | null
          evidencia_obrigatoria?: boolean
          id?: string
          ordem?: number
          pergunta?: string
          sla_dias?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "audit_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_processes: {
        Row: {
          created_at: string
          id: number
          name: string
          ordem: number
          weight: number
        }
        Insert: {
          created_at?: string
          id: number
          name: string
          ordem: number
          weight?: number
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          ordem?: number
          weight?: number
        }
        Relationships: []
      }
      audit_reports: {
        Row: {
          created_at: string
          empreendimento_id: string
          generated_by: string | null
          id: string
          observacoes: string | null
          overall_compliance: number | null
          period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          generated_by?: string | null
          id?: string
          observacoes?: string | null
          overall_compliance?: number | null
          period: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          generated_by?: string | null
          id?: string
          observacoes?: string | null
          overall_compliance?: number | null
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_reports_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_results: {
        Row: {
          actual: number
          id: string
          notes: string | null
          report_id: string
          status: Database["public"]["Enums"]["audit_status"]
          subprocess_id: string
          updated_at: string
        }
        Insert: {
          actual?: number
          id?: string
          notes?: string | null
          report_id: string
          status?: Database["public"]["Enums"]["audit_status"]
          subprocess_id: string
          updated_at?: string
        }
        Update: {
          actual?: number
          id?: string
          notes?: string | null
          report_id?: string
          status?: Database["public"]["Enums"]["audit_status"]
          subprocess_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "audit_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_results_subprocess_id_fkey"
            columns: ["subprocess_id"]
            isOneToOne: false
            referencedRelation: "audit_subprocesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_subprocesses: {
        Row: {
          id: string
          indicator: string | null
          metric: string | null
          name: string
          objective: string | null
          ordem: number
          process_id: number
          recommended_action: string | null
          target: number
          weight: number
        }
        Insert: {
          id: string
          indicator?: string | null
          metric?: string | null
          name: string
          objective?: string | null
          ordem?: number
          process_id: number
          recommended_action?: string | null
          target?: number
          weight?: number
        }
        Update: {
          id?: string
          indicator?: string | null
          metric?: string | null
          name?: string
          objective?: string | null
          ordem?: number
          process_id?: number
          recommended_action?: string | null
          target?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_subprocesses_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "audit_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          canal: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          empreendimento_id: string
          id: string
          investimento: number
          meta: number
          nome: string
          observacoes: string | null
          resultado: number
          status: Database["public"]["Enums"]["campanha_status"]
          updated_at: string
        }
        Insert: {
          canal?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          empreendimento_id: string
          id?: string
          investimento?: number
          meta?: number
          nome: string
          observacoes?: string | null
          resultado?: number
          status?: Database["public"]["Enums"]["campanha_status"]
          updated_at?: string
        }
        Update: {
          canal?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          empreendimento_id?: string
          id?: string
          investimento?: number
          meta?: number
          nome?: string
          observacoes?: string | null
          resultado?: number
          status?: Database["public"]["Enums"]["campanha_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      empreendimentos: {
        Row: {
          area_total: number | null
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          codigo: string
          created_at: string
          endereco: string | null
          id: string
          nome: string
          sindico_celular: string | null
          sindico_cpf: string | null
          sindico_email: string | null
          sindico_mandato_vencimento: string | null
          sindico_nome: string | null
          updated_at: string
        }
        Insert: {
          area_total?: number | null
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          codigo: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          sindico_celular?: string | null
          sindico_cpf?: string | null
          sindico_email?: string | null
          sindico_mandato_vencimento?: string | null
          sindico_nome?: string | null
          updated_at?: string
        }
        Update: {
          area_total?: number | null
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          codigo?: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          sindico_celular?: string | null
          sindico_cpf?: string | null
          sindico_email?: string | null
          sindico_mandato_vencimento?: string | null
          sindico_nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evidences: {
        Row: {
          answer_id: string
          created_at: string
          empreendimento_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          answer_id: string
          created_at?: string
          empreendimento_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          answer_id?: string
          created_at?: string
          empreendimento_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidences_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "audit_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cargo: string | null
          created_at: string
          email: string
          empreendimento_id: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email: string
          empreendimento_id?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string
          empreendimento_id?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empreendimento_id_fkey"
            columns: ["empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_operational_scores: {
        Row: {
          category_id: number | null
          conformes: number | null
          empreendimento_id: string | null
          nao_conformes: number | null
          parciais: number | null
          pendentes: number | null
          periodo: string | null
          score: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "audit_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_edit_empreendimento: {
        Args: { _emp_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_empreendimento: {
        Args: { _emp_id: string; _user_id: string }
        Returns: boolean
      }
      get_user_empreendimento: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      action_status:
        | "aberto"
        | "em_andamento"
        | "concluido"
        | "vencido"
        | "cancelado"
      answer_status:
        | "conforme"
        | "nao_conforme"
        | "parcial"
        | "nao_aplicavel"
        | "pendente"
      app_role:
        | "diretoria"
        | "gestor"
        | "sindico"
        | "administrador"
        | "diretor"
        | "gerente_regional"
        | "auditor"
        | "cliente"
      audit_status: "compliant" | "warning" | "critical"
      campanha_status: "planejada" | "em_andamento" | "concluida" | "cancelada"
      criticidade: "baixa" | "media" | "alta" | "critica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_status: [
        "aberto",
        "em_andamento",
        "concluido",
        "vencido",
        "cancelado",
      ],
      answer_status: [
        "conforme",
        "nao_conforme",
        "parcial",
        "nao_aplicavel",
        "pendente",
      ],
      app_role: [
        "diretoria",
        "gestor",
        "sindico",
        "administrador",
        "diretor",
        "gerente_regional",
        "auditor",
        "cliente",
      ],
      audit_status: ["compliant", "warning", "critical"],
      campanha_status: ["planejada", "em_andamento", "concluida", "cancelada"],
      criticidade: ["baixa", "media", "alta", "critica"],
    },
  },
} as const
