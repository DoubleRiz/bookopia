export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      double_page: {
        Row: {
          cree_le: string
          gabarit_origine_id: string | null
          id: string
          position: number | null
          projet_id: string
          role: Database["public"]["Enums"]["role_double_page"]
        }
        Insert: {
          cree_le?: string
          gabarit_origine_id?: string | null
          id?: string
          position?: number | null
          projet_id: string
          role: Database["public"]["Enums"]["role_double_page"]
        }
        Update: {
          cree_le?: string
          gabarit_origine_id?: string | null
          id?: string
          position?: number | null
          projet_id?: string
          role?: Database["public"]["Enums"]["role_double_page"]
        }
        Relationships: [
          {
            foreignKeyName: "double_page_gabarit_origine_id_fkey"
            columns: ["gabarit_origine_id"]
            isOneToOne: false
            referencedRelation: "gabarit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "double_page_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projet"
            referencedColumns: ["id"]
          },
        ]
      }
      emplacement: {
        Row: {
          cadrage_x: number | null
          cadrage_y: number | null
          cadrage_zoom: number | null
          contenu_texte: string | null
          double_page_id: string
          hauteur: number
          id: string
          indice: number
          largeur: number
          nature: Database["public"]["Enums"]["nature_emplacement"]
          photo_id: string | null
          projet_id: string
          x: number
          y: number
        }
        Insert: {
          cadrage_x?: number | null
          cadrage_y?: number | null
          cadrage_zoom?: number | null
          contenu_texte?: string | null
          double_page_id: string
          hauteur: number
          id?: string
          indice: number
          largeur: number
          nature: Database["public"]["Enums"]["nature_emplacement"]
          photo_id?: string | null
          projet_id: string
          x: number
          y: number
        }
        Update: {
          cadrage_x?: number | null
          cadrage_y?: number | null
          cadrage_zoom?: number | null
          contenu_texte?: string | null
          double_page_id?: string
          hauteur?: number
          id?: string
          indice?: number
          largeur?: number
          nature?: Database["public"]["Enums"]["nature_emplacement"]
          photo_id?: string | null
          projet_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "emplacement_projet_id_double_page_id_fkey"
            columns: ["projet_id", "double_page_id"]
            isOneToOne: false
            referencedRelation: "double_page"
            referencedColumns: ["projet_id", "id"]
          },
          {
            foreignKeyName: "emplacement_projet_id_photo_id_fkey"
            columns: ["projet_id", "photo_id"]
            isOneToOne: false
            referencedRelation: "photo"
            referencedColumns: ["projet_id", "id"]
          },
        ]
      }
      export: {
        Row: {
          cle_stockage: string
          cree_le: string
          id: string
          projet_id: string
        }
        Insert: {
          cle_stockage: string
          cree_le?: string
          id?: string
          projet_id: string
        }
        Update: {
          cle_stockage?: string
          cree_le?: string
          id?: string
          projet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: true
            referencedRelation: "projet"
            referencedColumns: ["id"]
          },
        ]
      }
      gabarit: {
        Row: {
          actif: boolean
          definition: Json
          famille: string
          id: string
          nom: string
          role: Database["public"]["Enums"]["role_double_page"]
        }
        Insert: {
          actif?: boolean
          definition: Json
          famille: string
          id?: string
          nom: string
          role: Database["public"]["Enums"]["role_double_page"]
        }
        Update: {
          actif?: boolean
          definition?: Json
          famille?: string
          id?: string
          nom?: string
          role?: Database["public"]["Enums"]["role_double_page"]
        }
        Relationships: []
      }
      modele_livre: {
        Row: {
          actif: boolean
          cle_apercu: string
          famille: string
          gabarit_couverture_id: string
          gabarit_quatrieme_id: string
          id: string
          nom: string
          nombre_doubles_pages_depart: number
          theme_id: string
        }
        Insert: {
          actif?: boolean
          cle_apercu: string
          famille: string
          gabarit_couverture_id: string
          gabarit_quatrieme_id: string
          id?: string
          nom: string
          nombre_doubles_pages_depart: number
          theme_id: string
        }
        Update: {
          actif?: boolean
          cle_apercu?: string
          famille?: string
          gabarit_couverture_id?: string
          gabarit_quatrieme_id?: string
          id?: string
          nom?: string
          nombre_doubles_pages_depart?: number
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modele_livre_gabarit_couverture_id_fkey"
            columns: ["gabarit_couverture_id"]
            isOneToOne: false
            referencedRelation: "gabarit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modele_livre_gabarit_quatrieme_id_fkey"
            columns: ["gabarit_quatrieme_id"]
            isOneToOne: false
            referencedRelation: "gabarit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modele_livre_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "theme"
            referencedColumns: ["id"]
          },
        ]
      }
      photo: {
        Row: {
          cle_stockage: string
          cree_le: string
          empreinte_fichier: string
          format_vignette: Database["public"]["Enums"]["format_vignette"]
          hauteur_px: number
          id: string
          largeur_px: number
          nom_fichier_origine: string
          prise_le: string | null
          projet_id: string
          source_type: Database["public"]["Enums"]["source_photo"]
        }
        Insert: {
          cle_stockage: string
          cree_le?: string
          empreinte_fichier: string
          format_vignette: Database["public"]["Enums"]["format_vignette"]
          hauteur_px: number
          id?: string
          largeur_px: number
          nom_fichier_origine: string
          prise_le?: string | null
          projet_id: string
          source_type?: Database["public"]["Enums"]["source_photo"]
        }
        Update: {
          cle_stockage?: string
          cree_le?: string
          empreinte_fichier?: string
          format_vignette?: Database["public"]["Enums"]["format_vignette"]
          hauteur_px?: number
          id?: string
          largeur_px?: number
          nom_fichier_origine?: string
          prise_le?: string | null
          projet_id?: string
          source_type?: Database["public"]["Enums"]["source_photo"]
        }
        Relationships: [
          {
            foreignKeyName: "photo_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projet"
            referencedColumns: ["id"]
          },
        ]
      }
      projet: {
        Row: {
          brouillon: boolean
          cree_le: string
          id: string
          modele_origine_id: string | null
          modifie_le: string
          theme_id: string
          titre: string
          utilisateur_id: string
        }
        Insert: {
          brouillon?: boolean
          cree_le?: string
          id?: string
          modele_origine_id?: string | null
          modifie_le?: string
          theme_id: string
          titre: string
          utilisateur_id: string
        }
        Update: {
          brouillon?: boolean
          cree_le?: string
          id?: string
          modele_origine_id?: string | null
          modifie_le?: string
          theme_id?: string
          titre?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projet_modele_origine_id_fkey"
            columns: ["modele_origine_id"]
            isOneToOne: false
            referencedRelation: "modele_livre"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projet_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "theme"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projet_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateur"
            referencedColumns: ["id"]
          },
        ]
      }
      theme: {
        Row: {
          actif: boolean
          bordure_cadre: Json | null
          id: string
          marge_interieure: number
          nom: string
          palette: Json
          police_texte: string
          police_titre: string
          rayon_angles: number
        }
        Insert: {
          actif?: boolean
          bordure_cadre?: Json | null
          id?: string
          marge_interieure: number
          nom: string
          palette: Json
          police_texte: string
          police_titre: string
          rayon_angles: number
        }
        Update: {
          actif?: boolean
          bordure_cadre?: Json | null
          id?: string
          marge_interieure?: number
          nom?: string
          palette?: Json
          police_texte?: string
          police_titre?: string
          rayon_angles?: number
        }
        Relationships: []
      }
      utilisateur: {
        Row: {
          cree_le: string
          id: string
          nom_affichage: string
        }
        Insert: {
          cree_le?: string
          id: string
          nom_affichage: string
        }
        Update: {
          cree_le?: string
          id?: string
          nom_affichage?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      creer_double_page: {
        Args: {
          p_gabarit_id: string
          p_position: number
          p_projet_id: string
          p_role: Database["public"]["Enums"]["role_double_page"]
        }
        Returns: string
      }
      creer_projet: {
        Args: {
          p_gabarits_interieurs_ids: string[]
          p_modele_livre_id: string
          p_titre: string
        }
        Returns: string
      }
      deplacer_double_page: {
        Args: { p_double_page_id: string; p_position: number }
        Returns: undefined
      }
      dupliquer_double_page: {
        Args: { p_double_page_id: string }
        Returns: string
      }
      est_mon_projet: { Args: { p_projet_id: string }; Returns: boolean }
      inserer_double_page: {
        Args: { p_gabarit_id: string; p_position: number; p_projet_id: string }
        Returns: string
      }
      supprimer_double_page: {
        Args: { p_double_page_id: string }
        Returns: undefined
      }
      verrouiller_interieure: {
        Args: { p_double_page_id: string }
        Returns: {
          cree_le: string
          gabarit_origine_id: string | null
          id: string
          position: number | null
          projet_id: string
          role: Database["public"]["Enums"]["role_double_page"]
        }
        SetofOptions: {
          from: "*"
          to: "double_page"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verrouiller_projet: { Args: { p_projet_id: string }; Returns: undefined }
    }
    Enums: {
      format_vignette: "webp" | "jpeg"
      nature_emplacement: "photo" | "texte"
      role_double_page: "couverture" | "interieur" | "quatrieme"
      source_photo: "upload" | "google_photos"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      format_vignette: ["webp", "jpeg"],
      nature_emplacement: ["photo", "texte"],
      role_double_page: ["couverture", "interieur", "quatrieme"],
      source_photo: ["upload", "google_photos"],
    },
  },
} as const

